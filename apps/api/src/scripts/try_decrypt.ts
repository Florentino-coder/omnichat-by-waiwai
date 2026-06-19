import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "crypto";

const prisma = new PrismaClient();

function tryDecrypt(encrypted: string, keyBuffer: Buffer): string | null {
  try {
    const [ivValue, tagValue, ciphertextValue] = encrypted.split(".");
    if (!ivValue || !tagValue || !ciphertextValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyBuffer, Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch (e: any) {
    return null;
  }
}

async function main() {
  const channels = await prisma.lineChannel.findMany();
  if (channels.length === 0) {
    console.log("No channels found");
    return;
  }
  const token = channels[0].encryptedChannelAccessToken;
  console.log("Encrypted token sample:", token.slice(0, 30) + "...");

  // Let's build candidate keys
  const candidates: { name: string; key: Buffer }[] = [];

  // 1. Test key (Buffer of 7s)
  candidates.push({
    name: "Test key (Buffer.alloc(32, 7))",
    key: Buffer.alloc(32, 7),
  });

  // 2. Zero key (Buffer of 0s)
  candidates.push({
    name: "Zero key (Buffer.alloc(32, 0))",
    key: Buffer.alloc(32, 0),
  });

  // 3. Raw "replace-with-32-byte-base64-key" padded with nulls to 32 bytes
  const rawKeyStr = "replace-with-32-byte-base64-key";
  const paddedRawKey = Buffer.concat([Buffer.from(rawKeyStr), Buffer.alloc(32 - rawKeyStr.length, 0)]);
  candidates.push({
    name: "Raw key padded with nulls",
    key: paddedRawKey,
  });

  // 4. Raw key space padded
  const spacePadded = Buffer.concat([Buffer.from(rawKeyStr), Buffer.from(" ".repeat(32 - rawKeyStr.length))]);
  candidates.push({
    name: "Raw key padded with spaces",
    key: spacePadded,
  });

  // 5. Try if the user actually put a valid key somewhere, let's see.
  // Is there any key in env that we can parse?
  // Let's try base64 decoding "replace-with-32-byte-base64-key" but pad it first to be valid base64
  // "replace-with-32-byte-base64-key" is 31 chars. Valid base64 length is multiple of 4.
  // 32 chars: "replace-with-32-byte-base64-key=" (length 32)
  try {
    const b64Dec = Buffer.from(rawKeyStr + "=", "base64");
    if (b64Dec.length === 24) {
      // pad to 32
      candidates.push({
        name: "Base64 decode rawKeyStr+= padded to 32 bytes",
        key: Buffer.concat([b64Dec, Buffer.alloc(8, 0)]),
      });
    }
  } catch {}

  for (const cand of candidates) {
    const dec = tryDecrypt(token, cand.key);
    if (dec) {
      console.log(`Success with: ${cand.name}!`);
      console.log("Decrypted (first 10 chars):", dec.slice(0, 10) + "...");
      console.log("Key base64 to put in .env:", cand.key.toString("base64"));
      return;
    }
  }

  console.log("None of the candidate keys succeeded.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
