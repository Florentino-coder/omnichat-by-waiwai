import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== AUDIT LOGS ===");
  const logs = await prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  console.log(logs.map(l => ({
    id: l.id,
    action: l.action,
    userId: l.userId,
    targetType: l.targetType,
    targetId: l.targetId,
    createdAt: l.createdAt,
    metadata: l.metadata,
  })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
