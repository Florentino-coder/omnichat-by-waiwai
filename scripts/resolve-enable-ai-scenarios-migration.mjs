#!/usr/bin/env node
/**
 * Unblocks Prisma P3009 for 20260621250000_add_enable_ai_scenarios on production.
 *
 * Safe to run on every deploy — no-op when migration is healthy.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260621250000_add_enable_ai_scenarios";

const prisma = new PrismaClient();

try {
  const columnRows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_settings'
        AND column_name = 'enable_ai_scenarios'
    ) AS "exists"`;

  const columnExists = columnRows[0]?.exists === true;

  const migrationRows = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at, logs
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIGRATION_NAME}
    ORDER BY started_at DESC
    LIMIT 1`;

  const migrationRow = migrationRows[0];

  console.log("[migrate-repair] Column enable_ai_scenarios exists:", columnExists);
  console.log("[migrate-repair] Migration row:", migrationRow ?? "(none)");

  if (!migrationRow) {
    console.log("[migrate-repair] No failed row — continue with migrate deploy.");
    process.exit(0);
  }

  if (migrationRow.finished_at && !migrationRow.rolled_back_at) {
    console.log("[migrate-repair] Migration already applied.");
    process.exit(0);
  }

  const resolveFlag = columnExists ? "--applied" : "--rolled-back";
  console.log(
    `[migrate-repair] Resolving: prisma migrate resolve ${resolveFlag} ${MIGRATION_NAME}`
  );

  execSync(`npx prisma migrate resolve ${resolveFlag} ${MIGRATION_NAME}`, {
    stdio: "inherit",
    env: process.env
  });

  console.log("[migrate-repair] Resolve complete.");
} catch (error) {
  console.error("[migrate-repair] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
