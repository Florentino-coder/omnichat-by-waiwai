import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { AuditAction, BackupRunStatus, BackupRunType, Prisma } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs, createReadStream, createWriteStream } from "fs";
import * as path from "path";
import * as os from "os";
import { createGzip, gunzip } from "zlib";
import { pipeline } from "stream/promises";
import { PrismaService } from "../prisma/prisma.service";

const execAsync = promisify(exec);
const gunzipAsync = promisify(gunzip);

export type BackupRunSummary = {
  id: string;
  runType: BackupRunType;
  status: BackupRunStatus;
  r2Key: string | null;
  bucket: string;
  sizeBytes: string | null;
  errorMessage: string | null;
  triggeredByUserId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
};

export type BackupHealthSummary = {
  status: "healthy" | "degraded" | "unhealthy";
  latestSuccessfulBackup: BackupRunSummary | null;
  latestFailedBackup: BackupRunSummary | null;
  failuresLast7Days: number;
  backupBucket: string;
};

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3Client: S3Client;
  private readonly backupBucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const accountId = this.configService.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.configService.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>("R2_SECRET_ACCESS_KEY");
    this.backupBucket = this.configService.get<string>("R2_BUCKET_BACKUPS") || "chatwai-backups";

    if (!accountId || !accessKeyId || !secretAccessKey) {
      this.s3Client = new S3Client({
        region: "auto",
        endpoint: `https://placeholder-r2-endpoint.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: "placeholder",
          secretAccessKey: "placeholder"
        }
      });
    } else {
      this.s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    }
  }

  /**
   * Daily Backup - runs at 02:00 Bangkok time (19:00 UTC)
   */
  @Cron("0 19 * * *")
  async runDailyBackup() {
    this.logger.log("Starting daily database backup job...");
    const dateStr = new Date().toISOString().split("T")[0];
    const key = `daily/daily-${dateStr}.sql.gz`;
    await this.performBackup(key, BackupRunType.DAILY);
  }

  /**
   * Weekly Backup - runs every Sunday at 02:15 Bangkok time (19:15 UTC)
   */
  @Cron("15 19 * * 0")
  async runWeeklyBackup() {
    this.logger.log("Starting weekly database backup job...");
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const weekNumber = Math.ceil((dayOfYear + start.getDay() + 1) / 7);

    const key = `weekly/weekly-${year}-week${weekNumber}.sql.gz`;
    await this.performBackup(key, BackupRunType.WEEKLY);
  }

  /**
   * Monthly Backup - runs on the 1st of every month at 02:30 Bangkok time (19:30 UTC)
   */
  @Cron("30 19 1 * *")
  async runMonthlyBackup() {
    this.logger.log("Starting monthly database backup job...");
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const key = `monthly/monthly-${year}-${month}.sql.gz`;
    await this.performBackup(key, BackupRunType.MONTHLY);
  }

  async triggerManualBackup(triggeredByUserId: string): Promise<BackupRunSummary> {
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `manual/manual-${dateStr}.sql.gz`;

    await this.writeBackupAudit(AuditAction.BACKUP_RUN_TRIGGERED, triggeredByUserId, {
      runType: BackupRunType.MANUAL,
      r2Key: key
    });

    const run = await this.performBackup(key, BackupRunType.MANUAL, triggeredByUserId);
    return this.serializeRun(run);
  }

  async listRuns(limit = 50): Promise<BackupRunSummary[]> {
    const runs = await this.prisma.backupRun.findMany({
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200)
    });

    return runs.map((run) => this.serializeRun(run));
  }

  async getHealth(): Promise<BackupHealthSummary> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [latestSuccessfulBackup, latestFailedBackup, failuresLast7Days] = await Promise.all([
      this.prisma.backupRun.findFirst({
        where: {
          status: BackupRunStatus.SUCCESS,
          runType: {
            in: [BackupRunType.DAILY, BackupRunType.WEEKLY, BackupRunType.MONTHLY, BackupRunType.MANUAL]
          }
        },
        orderBy: { completedAt: "desc" }
      }),
      this.prisma.backupRun.findFirst({
        where: { status: BackupRunStatus.FAILED },
        orderBy: { completedAt: "desc" }
      }),
      this.prisma.backupRun.count({
        where: {
          status: BackupRunStatus.FAILED,
          startedAt: { gte: sevenDaysAgo }
        }
      })
    ]);

    const latestSuccessAt = latestSuccessfulBackup?.completedAt ?? null;
    const isStale =
      !latestSuccessAt || latestSuccessAt.getTime() < Date.now() - 36 * 60 * 60 * 1000;

    let status: BackupHealthSummary["status"] = "healthy";
    if (failuresLast7Days > 0 || isStale) {
      status = "degraded";
    }
    if (failuresLast7Days >= 3 || (!latestSuccessfulBackup && failuresLast7Days > 0)) {
      status = "unhealthy";
    }

    return {
      status,
      latestSuccessfulBackup: latestSuccessfulBackup
        ? this.serializeRun(latestSuccessfulBackup)
        : null,
      latestFailedBackup: latestFailedBackup ? this.serializeRun(latestFailedBackup) : null,
      failuresLast7Days,
      backupBucket: this.backupBucket
    };
  }

  /**
   * Core backup logic
   */
  async performBackup(
    r2Key: string,
    runType: BackupRunType,
    triggeredByUserId?: string
  ): Promise<Prisma.BackupRunGetPayload<Record<string, never>>> {
    const run = await this.prisma.backupRun.create({
      data: {
        runType,
        status: BackupRunStatus.RUNNING,
        r2Key,
        bucket: this.backupBucket,
        triggeredByUserId: triggeredByUserId ?? null
      }
    });

    const directUrl =
      this.configService.get<string>("DIRECT_URL") ||
      this.configService.get<string>("DATABASE_URL");
    if (!directUrl) {
      const err = "Database connection string (DIRECT_URL/DATABASE_URL) is not configured.";
      await this.markRunFailed(run.id, err, triggeredByUserId, runType, r2Key);
      this.logger.error(err);
      throw new Error(err);
    }

    const tempDir = os.tmpdir();
    const tempSqlPath = path.join(tempDir, "backup-" + Date.now() + ".sql");
    const tempGzPath = tempSqlPath + ".gz";

    try {
      const parsed = this.parseConnectionString(directUrl);
      if (!parsed) {
        throw new Error("Invalid PostgreSQL connection string format");
      }

      this.logger.log(`Running pg_dump command to dump DB schema & data...`);

      const command = `pg_dump -h ${parsed.host} -p ${parsed.port} -U ${parsed.username} -d ${parsed.database} -F p -b -v -f "${tempSqlPath}"`;

      await execAsync(command, {
        env: {
          ...process.env,
          PGPASSWORD: parsed.password
        }
      });

      this.logger.log(`pg_dump completed. Compressing SQL file...`);

      const sourceStream = createReadStream(tempSqlPath);
      const destinationStream = createWriteStream(tempGzPath);
      const gzip = createGzip();

      await pipeline(sourceStream, gzip, destinationStream);
      this.logger.log(`Compression finished. Uploading to R2: ${r2Key}...`);

      const gzBuffer = await fs.readFile(tempGzPath);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.backupBucket,
          Key: r2Key,
          Body: gzBuffer,
          ContentType: "application/gzip"
        })
      );

      this.logger.log(`Upload completed. Verifying uploaded file...`);

      const head = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.backupBucket,
          Key: r2Key
        })
      );

      const completedRun = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: BackupRunStatus.SUCCESS,
          sizeBytes: head.ContentLength ?? null,
          completedAt: new Date()
        }
      });

      await this.writeBackupAudit(AuditAction.BACKUP_RUN_SUCCEEDED, triggeredByUserId, {
        runId: run.id,
        runType,
        r2Key,
        sizeBytes: head.ContentLength ?? null
      });

      this.logger.log(`Backup verified successfully! Size: ${head.ContentLength} bytes.`);
      return completedRun;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.markRunFailed(run.id, message, triggeredByUserId, runType, r2Key);
      this.logger.error(`Database backup failed for key ${r2Key}:`, err);
      throw err;
    } finally {
      await fs.unlink(tempSqlPath).catch(() => {});
      await fs.unlink(tempGzPath).catch(() => {});
    }
  }

  /**
   * Weekly Verification - runs every Monday at 04:00 Bangkok time (21:00 UTC)
   */
  @Cron("0 21 * * 1")
  async runWeeklyVerification() {
    this.logger.log("Starting weekly database backup verification job...");
    const dateStr = new Date().toISOString().split("T")[0];
    const key = `daily/daily-${dateStr}.sql.gz`;

    const run = await this.prisma.backupRun.create({
      data: {
        runType: BackupRunType.VERIFICATION,
        status: BackupRunStatus.RUNNING,
        r2Key: key,
        bucket: this.backupBucket
      }
    });

    try {
      this.logger.log(`Downloading latest daily backup for verification: ${key}...`);

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.backupBucket,
          Key: key
        })
      );

      if (!response.Body) {
        throw new Error("Empty backup object body");
      }

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      const gzBuffer = Buffer.concat(chunks);

      this.logger.log("Decompressing backup data...");

      const sqlBuffer = await gunzipAsync(gzBuffer);
      const sqlText = sqlBuffer.toString("utf-8");

      this.logger.log("Verifying SQL structure and key tables...");

      const checks = [
        "CREATE TABLE",
        "INSERT INTO",
        "users",
        "tenants",
        "conversations",
        "messages"
      ];

      const missing = checks.filter((term) => !sqlText.includes(term));
      if (missing.length > 0) {
        throw new Error(`SQL integrity checks failed. Missing terms: ${missing.join(", ")}`);
      }

      await this.prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: BackupRunStatus.SUCCESS,
          sizeBytes: gzBuffer.length,
          completedAt: new Date()
        }
      });

      await this.writeBackupAudit(AuditAction.BACKUP_RUN_SUCCEEDED, undefined, {
        runId: run.id,
        runType: BackupRunType.VERIFICATION,
        r2Key: key
      });

      this.logger.log("Database backup file integrity verified successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.markRunFailed(run.id, message, undefined, BackupRunType.VERIFICATION, key);
      this.logger.error("Database backup verification failed:", err);
    }
  }

  private async markRunFailed(
    runId: string,
    errorMessage: string,
    triggeredByUserId: string | undefined,
    runType: BackupRunType,
    r2Key: string
  ): Promise<void> {
    await this.prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: BackupRunStatus.FAILED,
        errorMessage,
        completedAt: new Date()
      }
    });

    await this.writeBackupAudit(AuditAction.BACKUP_RUN_FAILED, triggeredByUserId, {
      runId,
      runType,
      r2Key,
      errorMessage
    });
  }

  private async writeBackupAudit(
    action: AuditAction,
    userId: string | undefined,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const tenantId = await this.getPlatformAuditTenantId();
    if (!tenantId) {
      this.logger.warn(`Skipping backup audit log (${action}) because no tenant exists yet`);
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? null,
        action,
        targetType: "BackupRun",
        targetId: typeof metadata.runId === "string" ? metadata.runId : null,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }

  private async getPlatformAuditTenantId(): Promise<string | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });

    return tenant?.id ?? null;
  }

  private serializeRun(
    run: Prisma.BackupRunGetPayload<Record<string, never>>
  ): BackupRunSummary {
    return {
      id: run.id,
      runType: run.runType,
      status: run.status,
      r2Key: run.r2Key,
      bucket: run.bucket,
      sizeBytes: run.sizeBytes?.toString() ?? null,
      errorMessage: run.errorMessage,
      triggeredByUserId: run.triggeredByUserId,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      createdAt: run.createdAt
    };
  }

  /**
   * Parse postgres URL credentials safely
   */
  private parseConnectionString(connectionString: string) {
    try {
      const cleaned = connectionString.trim();
      const url = new URL(cleaned);

      return {
        host: url.hostname,
        port: url.port || "5432",
        username: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, "")
      };
    } catch {
      const regex = /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/(.+)$/;
      const match = connectionString.match(regex);
      if (!match) {
        return null;
      }
      return {
        username: match[1],
        password: decodeURIComponent(match[2]),
        host: match[3],
        port: match[4] || "5432",
        database: match[5].split("?")[0]
      };
    }
  }
}
