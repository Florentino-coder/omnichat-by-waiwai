import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== CHANNELS ===");
  const channels = await prisma.lineChannel.findMany();
  console.log(channels.map(c => ({
    id: c.id,
    name: c.name,
    lineChannelId: c.lineChannelId,
    encryptedAccessTokenLength: c.encryptedChannelAccessToken?.length,
  })));

  console.log("=== CONVERSATIONS ===");
  const conversations = await prisma.conversation.findMany();
  console.log(conversations.map(c => ({
    id: c.id,
    displayName: c.displayName,
    pictureUrl: c.pictureUrl,
    lineChannelId: c.lineChannelId,
    externalThreadId: c.externalThreadId,
  })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
