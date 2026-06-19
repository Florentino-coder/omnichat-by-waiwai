import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "crypto";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "apps/api/.env"),
    path.resolve(process.cwd(), "../apps/api/.env")
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine.startsWith("#")) {
          continue;
        }
        const eqIdx = cleanLine.indexOf("=");
        if (eqIdx === -1) continue;
        const key = cleanLine.slice(0, eqIdx).trim();
        let value = cleanLine.slice(eqIdx + 1).trim();

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        } else {
          // Strip inline comment preceded by spaces
          const commentIdx = value.search(/\s+#/);
          if (commentIdx !== -1) {
            value = value.slice(0, commentIdx).trim();
          }
        }

        if (!process.env[key]) {
          process.env[key] = value.trim();
        }
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL;
const encKey = process.env.ENCRYPTION_KEY;

if (!dbUrl || !encKey) {
  console.error("DATABASE_URL:", dbUrl ? "configured" : "missing");
  console.error("ENCRYPTION_KEY:", encKey ? "configured" : "missing");
  console.error("Error: Missing DATABASE_URL or ENCRYPTION_KEY in .env files.");
  process.exit(1);
}

if (encKey === "replace-with-32-byte-base64-key") {
  console.warn("\n======================================================================");
  console.warn("WARNING: ENCRYPTION_KEY is using the default placeholder value!");
  console.warn("To decrypt the access tokens and sync profiles, please update the ENCRYPTION_KEY");
  console.warn("in your local .env file to match your production/deployed environment key.");
  console.warn("======================================================================\n");
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

function decrypt(encrypted: string, keyBase64: string): string {
  const [ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  const trimmedKey = keyBase64.trim();
  const key = Buffer.from(trimmedKey, "base64");
  if (key.length !== 32) {
    throw new Error(`Invalid key length: base64 len=${trimmedKey.length}, buffer len=${key.length}, value="${trimmedKey}"`);
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64")),
    decipher.final()
  ]).toString("utf8");
}


async function run() {
  console.log("Querying conversations with missing pictureUrl...");
  const conversations = await prisma.conversation.findMany({
    where: {
      pictureUrl: null,
      source: "LINE"
    }
  });

  console.log(`Found ${conversations.length} conversations to sync.`);

  for (const conv of conversations) {
    if (!conv.lineChannelId) continue;
    const channel = await prisma.lineChannel.findUnique({
      where: { id: conv.lineChannelId }
    });
    if (!channel) continue;

    try {
      const token = decrypt(channel.encryptedChannelAccessToken, encKey);
      console.log(`Fetching profile from LINE for user: ${conv.externalThreadId}...`);
      const response = await fetch(`https://api.line.me/v2/bot/profile/${conv.externalThreadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const profile: any = await response.json();
        console.log(`Updating conversation ${conv.id} with displayName="${profile.displayName}" pictureUrl="${profile.pictureUrl}"`);
        await prisma.conversation.update({
          where: { id: conv.id },
          data: {
            displayName: profile.displayName || conv.displayName,
            pictureUrl: profile.pictureUrl || null
          }
        });
      } else {
        console.error(`Failed to fetch profile for ${conv.externalThreadId}: ${response.statusText} (${response.status})`);
      }
    } catch (err: any) {
      console.error(`Error processing conversation ${conv.id}: ${err.message}`);
    }
  }

  console.log("Sync complete!");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
