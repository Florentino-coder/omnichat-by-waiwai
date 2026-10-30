import { lookup, type LookupAddress, type LookupOptions } from "dns";
import { request } from "https";
import { isPrivateAddress } from "../knowledge/knowledge-url.util";

export type ConnectTransportRequest = {
  url: URL;
  headers: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
};

export type ConnectTransportResponse = {
  status: number;
  body: string;
};

export type ConnectTransport = (req: ConnectTransportRequest) => Promise<ConnectTransportResponse>;

type ResolveAll = (hostname: string) => Promise<LookupAddress[]>;

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;

const resolveAll: ResolveAll = (hostname) =>
  new Promise((resolve, reject) => {
    lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        reject(error);
      } else {
        resolve(addresses);
      }
    });
  });

/**
 * Merchants choose their own URL, so a hostname could resolve to an internal
 * address. Checking inside the socket's own DNS lookup means the address that
 * was validated is the one connected to, which also closes DNS rebinding.
 */
export const createSafeLookup =
  (resolve: ResolveAll = resolveAll) =>
  (hostname: string, options: LookupOptions, callback: LookupCallback): void => {
    resolve(hostname)
      .then((addresses) => {
        const [first] = addresses;
        if (!first || addresses.some(({ address }) => isPrivateAddress(address))) {
          callback(new Error("URL host is not allowed"), "");
          return;
        }
        if (options.all) {
          callback(null, addresses);
        } else {
          callback(null, first.address, first.family);
        }
      })
      .catch((error: NodeJS.ErrnoException) => callback(error, ""));
  };

export const httpsConnectTransport: ConnectTransport = ({ url, headers, timeoutMs, maxBytes }) =>
  new Promise((resolve, reject) => {
    // https.request never follows redirects, so a 3xx cannot reach another host.
    const req = request(url, { method: "GET", headers, lookup: createSafeLookup() }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy(new Error("Response size limit exceeded"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
      });
      res.on("error", reject);
    });

    const timer = setTimeout(() => req.destroy(new Error("Request timed out")), timeoutMs);
    req.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.end();
  });
