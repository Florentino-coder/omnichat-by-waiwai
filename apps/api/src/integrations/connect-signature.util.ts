import { createHash, createHmac } from "crypto";

export const CONNECT_HEADER_KEY_ID = "X-ChatWai-Key-Id";
export const CONNECT_HEADER_TIMESTAMP = "X-ChatWai-Timestamp";
export const CONNECT_HEADER_SIGNATURE = "X-ChatWai-Signature";

const EMPTY_BODY_HASH = createHash("sha256").update("").digest("hex");

/** The exact string both sides sign. Documented in docs/integrations/chatwai-connect-v1.md. */
export function buildConnectSigningPayload(
  timestamp: string,
  method: string,
  pathAndQuery: string,
  bodyHash: string = EMPTY_BODY_HASH
): string {
  return `${timestamp}.${method.toUpperCase()}.${pathAndQuery}.${bodyHash}`;
}

export function signConnectPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * During rotation both the new and old secrets sign, so a merchant still holding
 * the old secret keeps working until it switches.
 */
export function buildConnectHeaders(
  keyId: string,
  secrets: string[],
  url: URL,
  timestamp: string = String(Math.floor(Date.now() / 1000))
): Record<string, string> {
  const payload = buildConnectSigningPayload(timestamp, "GET", `${url.pathname}${url.search}`);
  return {
    [CONNECT_HEADER_KEY_ID]: keyId,
    [CONNECT_HEADER_TIMESTAMP]: timestamp,
    [CONNECT_HEADER_SIGNATURE]: secrets
      .map((secret) => `v1=${signConnectPayload(secret, payload)}`)
      .join(",")
  };
}
