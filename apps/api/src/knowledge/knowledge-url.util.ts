import { BadRequestException } from "@nestjs/common";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function isPrivateIpv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return false;
  }

  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  if (parts[0] === 10) {
    return true;
  }
  if (parts[0] === 127) {
    return true;
  }
  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  return false;
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
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || isPrivateIpv4(host)) {
    throw new BadRequestException("URL host is not allowed");
  }

  return parsed;
}

export async function fetchPublicUrlText(sourceUrl: string): Promise<string> {
  const parsed = assertSafePublicUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "OmniChatKnowledgeBot/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      throw new BadRequestException(`Failed to fetch URL (${response.status})`);
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength && contentLength > 5 * 1024 * 1024) {
      throw new BadRequestException("Response size exceeds limit (5MB)");
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

    if (body.length > 5 * 1024 * 1024) {
      throw new BadRequestException("Response size exceeds limit (5MB)");
    }

    if (contentType.includes("text/html") || body.includes("<html")) {
      return body;
    }

    return body;
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
