export type VerifiedJwtPayload = {
  sub: string;
  email?: string;
  tenantId?: string;
  workspaceId?: string;
  role?: string;
  isSuperOwner?: boolean;
  exp?: number;
};

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<VerifiedJwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || !secret) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signature = base64UrlToBytes(signaturePart);
  const valid = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!valid) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadPart))
    ) as VerifiedJwtPayload;

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
