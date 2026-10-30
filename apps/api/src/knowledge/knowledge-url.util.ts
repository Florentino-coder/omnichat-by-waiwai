import { BadRequestException } from "@nestjs/common";
import { lookup } from "dns/promises";
import { isIP } from "net";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;

export type HostResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

function isPrivateIpv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return false;
  }

  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  // Carrier-grade NAT, benchmarking, and multicast/reserved ranges.
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a >= 224) {
    return true;
  }

  return false;
}

function isPrivateIpv6(host: string): boolean {
  const address = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(address) !== 6) {
    return false;
  }

  if (address === "::" || address === "::1") {
    return true;
  }
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::/96) can reach IPv4 internals.
  if (address.startsWith("::ffff:") || address.startsWith("64:ff9b:")) {
    return true;
  }
  // Unique local fc00::/7, link-local fe80::/10, multicast ff00::/8.
  return /^(f[cd]|fe[89ab]|ff)/.test(address);
}

export function isPrivateAddress(address: string): boolean {
  return isPrivateIpv4(address) || isPrivateIpv6(address);
}

export function assertSafePublicUrl(sourceUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(sourceUrl.trim());
  } catch {
    throw new BadRequestException("Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new BadRequestException("Only https URLs are allowed");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    isPrivateAddress(host)
  ) {
    throw new BadRequestException("URL host is not allowed");
  }

  return parsed;
}

/**
 * Hostname checks alone are bypassable: a public-looking domain can resolve to
 * 10.x or 169.254.169.254. Resolve the host and reject any private address.
 */
export async function assertResolvesToPublicAddress(
  url: URL,
  resolve: HostResolver = defaultResolver
): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    return;
  }

  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    throw new BadRequestException("URL host could not be resolved");
  }

  if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address))) {
    throw new BadRequestException("URL host is not allowed");
  }
}

async function readBodyWithLimit(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new BadRequestException("Response size exceeds limit (5MB)");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function fetchPublicUrlText(
  sourceUrl: string,
  resolve: HostResolver = defaultResolver
): Promise<string> {
  let current = assertSafePublicUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let hop = 0; ; hop += 1) {
      await assertResolvesToPublicAddress(current, resolve);

      // Follow redirects manually so every hop is re-validated.
      const response = await fetch(current.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "OmniChatKnowledgeBot/1.0",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8"
        },
        redirect: "manual"
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop >= MAX_REDIRECTS) {
          throw new BadRequestException("Too many or invalid redirects");
        }
        current = assertSafePublicUrl(new URL(location, current).toString());
        continue;
      }

      if (!response.ok) {
        throw new BadRequestException(`Failed to fetch URL (${response.status})`);
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (contentLength && contentLength > MAX_RESPONSE_BYTES) {
        throw new BadRequestException("Response size exceeds limit (5MB)");
      }

      return await readBodyWithLimit(response);
    }
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException(
      error instanceof Error ? error.message : "Failed to fetch URL"
    );
  } finally {
    clearTimeout(timeout);
  }
}
