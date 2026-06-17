import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs, createReadStream, createWriteStream } from "fs";
import * as path from "path";
import * as os from "os";
import { createGzip, gunzip } from "zlib";
import { pipeline } from "stream/promises";

const execAsync = promisify(exec);
const gunzipAsync = promisify(gunzip);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3Client: S3Client;
  private readonly backupBucket: string;

  constructor(private readonly configService: ConfigService) {
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
    await this.performBackup(key);
  }

  /**
   * Weekly Backup - runs every Sunday at 02:15 Bangkok time (19:15 UTC)
   */
  @Cron("15 19 * * 0")
  async runWeeklyBackup() {
    this.logger.log("Starting weekly database backup job...");
    const now = new Date();
    const year = now.getFullYear();
    // Simple week number calculation
    const start = new Date(year, 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const weekNumber = Math.ceil((dayOfYear + start.getDay() + 1) / 7);
    
    const key = `weekly/weekly-${year}-week${weekNumber}.sql.gz`;
    await this.performBackup(key);
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
    await this.performBackup(key);
  }

  /**
   * Core backup logic
   */
  async performBackup(r2Key: string): Promise<string> {
    const directUrl = this.configService.get<string>("DIRECT_URL") || this.configService.get<string>("DATABASE_URL");
    if (!directUrl) {
      const err = "Database connection string (DIRECT_URL/DATABASE_URL) is not configured.";
      this.logger.error(err);
      throw new Error(err);
    }

    // Create temp files
    const tempDir = os.tmpdir();
    const tempSqlPath = path.join(tempDir, `backup-${Date.now()}.sql`);
    const tempGzPath = `${tempSqlPath}.gz`;

    try {
      // 1. Parse PostgreSQL connection URL
      const parsed = this.parseConnectionString(directUrl);
      if (!parsed) {
        throw new Error("Invalid PostgreSQL connection string format");
      }

      this.logger.log(`Running pg_dump command to dump DB schema & data...`);
      
      // 2. Execute pg_dump using child_process
      // Use PGPASSWORD env variable to avoid password prompt
      const command = `pg_dump -h ${parsed.host} -p ${parsed.port} -U ${parsed.username} -d ${parsed.database} -F p -b -v -f "${tempSqlPath}"`;
      
      await execAsync(command, {
        env: {
          ...process.env,
          PGPASSWORD: parsed.password
        }
      });

      this.logger.log(`pg_dump completed. Compressing SQL file...`);

      // 3. Compress using gzip
      const sourceStream = createReadStream(tempSqlPath);
      const destinationStream = createWriteStream(tempGzPath);
      const gzip = createGzip();

      await pipeline(sourceStream, gzip, destinationStream);
      this.logger.log(`Compression finished. Uploading to R2: ${r2Key}...`);

      // 4. Upload to Cloudflare R2
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

      // 5. Verify upload (HEAD Object)
      const head = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.backupBucket,
          Key: r2Key
        })
      );

      this.logger.log(`Backup verified successfully! Size: ${head.ContentLength} bytes.`);
      return r2Key;
    } catch (err) {
      this.logger.error(`Database backup failed for key ${r2Key}:`, err);
      throw err;
    } finally {
      // Cleanup temp files
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
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const key = `daily/daily-${dateStr}.sql.gz`;

      this.logger.log(`Downloading latest daily backup for verification: ${key}...`);

      // 1. Download object from R2
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.backupBucket,
          Key: key
        })
      );

      if (!response.Body) {
        throw new Error("Empty backup object body");
      }

      // Convert body to Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(Buffer.from(chunk));
      }
      const gzBuffer = Buffer.concat(chunks);

      this.logger.log("Decompressing backup data...");
      
      // 2. Decompress
      const sqlBuffer = await gunzipAsync(gzBuffer);
      const sqlText = sqlBuffer.toString("utf-8");

      this.logger.log("Verifying SQL structure and key tables...");

      // 3. Validation checks
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

      this.logger.log("Database backup file integrity verified successfully!");
    } catch (err) {
      this.logger.error("Database backup verification failed:", err);
    }
  }

  /**
   * Parse postgres URL credentials safely
   */
  private parseConnectionString(connectionString: string) {
    try {
      // Format: postgresql://username:password@host:port/database
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
      // Regex fallback if URL parser fails on complex connection strings
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
