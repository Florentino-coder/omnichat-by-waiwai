import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { MessageSource } from "@prisma/client";

async function run() {
  console.log("Bootstrapping NestJS context...");
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const cryptoSecret = app.get(CryptoSecretService);

  console.log("Querying conversations with missing pictureUrl...");
  const conversations = await prisma.conversation.findMany({
    where: {
      pictureUrl: null,
      source: MessageSource.LINE
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
      const token = cryptoSecret.decrypt(channel.encryptedChannelAccessToken);
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
  await app.close();
}

run().catch(console.error);
