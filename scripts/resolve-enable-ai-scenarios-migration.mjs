#!/usr/bin/env node
/**
 * Unblocks Prisma P3009 for 20260621250000_add_enable_ai_scenarios on production.
 *
 * Usage (set DATABASE_URL or DIRECT_URL to production first):
 *   node scripts/resolve-enable-ai-scenarios-migration.mjs
 *
 * Or: npm run prisma:resolve:enable-ai-scenarios
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260621250000_add_enable_ai_scenarios";

const prisma = new PrismaClient();

try {
  const columnRows = await prisma.$queryRaw<
    Array<{ exists: boolean }>
  >`SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_settings'
        AND column_name = 'enable_ai_scenarios'
    ) AS exists`;

  const columnExists = columnRows[0]?.exists === true;

  const migrationRows = await prisma.$queryRaw<
    Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
      logs: string | null;
    }>
  >`SELECT migration_name, finished_at, rolled_back_at, logs
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIGRATION_NAME}
    ORDER BY started_at DESC
    LIMIT 1`;

  const migrationRow = migrationRows[0];

  console.log("Column enable_ai_scenarios exists:", columnExists);
  console.log("Migration row:", migrationRow ?? "(none)");

  if (!migrationRow) {
    console.log("No migration row — run normal deploy (prisma migrate deploy).");
    process.exit(0);
  }

  if (migrationRow.finished_at && !migrationRow.rolled_back_at) {
    console.log("Migration already applied successfully.");
    process.exit(0);
  }

  const resolveFlag = columnExists ? "--applied" : "--rolled-back";
  console.log(`Resolving: prisma migrate resolve ${resolveFlag} ${MIGRATION_NAME}`);

  execSync(`npx prisma migrate resolve ${resolveFlag} ${MIGRATION_NAME}`, {
    stdio: "inherit",
    env: process.env
  });

  if (resolveFlag === "--rolled-back") {
    console.log("Next: redeploy so prisma migrate deploy re-runs this migration.");
  } else {
    console.log("Next: redeploy — migrate deploy should pass.");
  }
} finally {
  await prisma.$disconnect();
}
