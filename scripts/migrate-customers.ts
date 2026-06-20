import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration: Conversations -> Customers...");

  try {
    // 1. Verify count of tags and notes before migration
    const tagCountBefore = await prisma.conversationTagLink.count({ where: { deletedAt: null } });
    const noteCountBefore = await prisma.conversationInternalNote.count({ where: { deletedAt: null } });
    console.log(`Initial Verification: Active tags count = ${tagCountBefore}, Active notes count = ${noteCountBefore}`);

    // Fetch all conversations
    const conversations = await prisma.conversation.findMany({
      where: { deletedAt: null }
    });

    console.log(`Found ${conversations.length} conversations to process.`);

    let customersCreated = 0;
    let customerChannelsCreated = 0;
    let conversationsUpdated = 0;

    for (const conv of conversations) {
      const externalThreadId = conv.externalThreadId;
      if (!externalThreadId) {
        console.warn(`Conversation ${conv.id} has no externalThreadId. Skipping.`);
        continue;
      }

      // Check if there is an existing customer channel for this LINE user
      const existingChannel = await prisma.customerChannel.findFirst({
        where: {
          channelType: "line",
          channelUserId: externalThreadId
        }
      });

      let customerId: string;

      if (existingChannel) {
        customerId = existingChannel.customerId;
      } else {
        // Create customer
        const customer = await prisma.customer.create({
          data: {
            tenantId: conv.tenantId,
            displayName: conv.nickname || conv.displayName || "Line User",
            avatarUrl: conv.pictureUrl || null,
            channels: {
              create: {
                tenantId: conv.tenantId,
                channelType: "line",
                channelUserId: externalThreadId
              }
            }
          }
        });
        customerId = customer.id;
        customersCreated++;
        customerChannelsCreated++;
      }

      // Update conversation with customerId
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { customerId }
      });
      conversationsUpdated++;
    }

    console.log("Migration complete!");
    console.log(`- Customers created: ${customersCreated}`);
    console.log(`- Customer channels created: ${customerChannelsCreated}`);
    console.log(`- Conversations updated: ${conversationsUpdated}`);

    // 2. Verify count of tags and notes after migration
    const tagCountAfter = await prisma.conversationTagLink.count({ where: { deletedAt: null } });
    const noteCountAfter = await prisma.conversationInternalNote.count({ where: { deletedAt: null } });
    console.log(`Final Verification: Active tags count = ${tagCountAfter}, Active notes count = ${noteCountAfter}`);

    if (tagCountBefore !== tagCountAfter || noteCountBefore !== noteCountAfter) {
      console.error("CRITICAL ERROR: Tags or internal notes counts do not match after migration!");
      process.exit(1);
    } else {
      console.log("SUCCESS: Verification passed. Tags and notes counts match perfectly!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
