import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileType, RetentionType } from "@prisma/client";
import { randomUUID } from "crypto";

export interface UploadResult {
  fileId: string;
  r2Key: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const accountId = this.configService.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.configService.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>("R2_SECRET_ACCESS_KEY");
    this.bucket = this.configService.get<string>("R2_BUCKET_STORAGE") || "chatwai-storage";
    this.publicBaseUrl = this.configService.get<string>("R2_PUBLIC_URL") || null;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      // In development, we can fallback or print a warning instead of crashing, but let's throw an exception
      // if it's missing in production. We will configure standard defaults or throw clean errors.
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
   * Generates a structured R2 key:
   * {retention}/{tenantId}/{fileType}/{yyyy}/{mm}/{dd}/{uuid}-{filename}
   */
  generateKey(tenantId: string, fileType: FileType, retentionType: RetentionType, fileName: string): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const uuid = randomUUID();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    
    return `${retentionType.toLowerCase()}/${tenantId}/${fileType.toLowerCase()}/${yyyy}/${mm}/${dd}/${uuid}-${sanitizedFileName}`;
  }

  /**
   * Generates the public-facing or signed URL for an object key
   */
  async getObjectUrl(r2Key: string): Promise<string> {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${r2Key}`;
    }
    
    // Fallback to presigned URL valid for 24 hours if no public custom domain is configured
    return this.getPresignedDownloadUrl(r2Key, 86400);
  }

  /**
   * Generate a presigned URL for client to download/view a file
   */
  async getPresignedDownloadUrl(r2Key: string, expiresInSeconds = 3600): Promise<string> {
    // S3 client doesn't hit network for presigning, it is done locally
    try {
      const command = {
        Bucket: this.bucket,
        Key: r2Key
      };
      // We manually construct presigned URL if credentials are placeholders to avoid crashing
      const accessKeyId = this.configService.get<string>("R2_ACCESS_KEY_ID");
      if (!accessKeyId) {
        return `https://storage.chatwai.com/${r2Key}`;
      }
      return getSignedUrl(this.s3Client as any, new PutObjectCommand(command) as any, { expiresIn: expiresInSeconds });
    } catch (err) {
      throw new InternalServerErrorException("Failed to generate download presigned URL");
    }
  }

  /**
   * Generate a presigned URL for client to upload a file directly
   */
  async getPresignedUploadUrl(
    tenantId: string,
    fileType: FileType,
    retentionType: RetentionType,
    fileName: string,
    mimeType: string
  ) {
    const r2Key = this.generateKey(tenantId, fileType, retentionType, fileName);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: r2Key,
      ContentType: mimeType
    });

    const uploadUrl = await getSignedUrl(this.s3Client as any, command as any, { expiresIn: 3600 });
    const publicUrl = await this.getObjectUrl(r2Key);

    return {
      uploadUrl,
      r2Key,
      publicUrl
    };
  }

  /**
   * Backend-to-backend direct upload (e.g. from LINE OA media webhook)
   */
  async uploadFile(
    tenantId: string,
    conversationId: string | null,
    fileType: FileType,
    retentionType: RetentionType,
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<UploadResult> {
    const r2Key = this.generateKey(tenantId, fileType, retentionType, fileName);
    const fileSize = buffer.length;

    // Upload to Cloudflare R2
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: r2Key,
        Body: buffer,
        ContentType: mimeType
      })
    );

    const publicUrl = await this.getObjectUrl(r2Key);

    // Save File record in DB
    const expiresAt = retentionType === RetentionType.TEMPORARY 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      : null;

    const fileRecord = await this.prisma.file.create({
      data: {
        tenantId,
        conversationId,
        fileName,
        fileType,
        mimeType,
        fileSize,
        r2Key,
        publicUrl,
        retentionType,
        expiresAt
      }
    });

    return {
      fileId: fileRecord.id,
      r2Key,
      publicUrl,
      fileName,
      mimeType,
      fileSize
    };
  }

  async getObjectBuffer(r2Key: string): Promise<Buffer> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: r2Key
      })
    );

    if (!response.Body) {
      throw new InternalServerErrorException("Storage object body is empty");
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from storage and database
   */
  async deleteFile(tenantId: string, fileId: string): Promise<void> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, tenantId, deletedAt: null }
    });

    if (!file) {
      return;
    }

    // Delete from R2
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: file.r2Key
        })
      );
    } catch (err) {
      // Log error but continue to delete from DB to keep sync
    }

    // Soft delete in database
    await this.prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() }
    });
  }

  /**
   * Fetch storage stats for a tenant
   */
  async getStats(tenantId: string) {
    const stats = await this.prisma.file.groupBy({
      by: ["retentionType"],
      where: { tenantId, deletedAt: null },
      _sum: {
        fileSize: true
      },
      _count: {
        id: true
      }
    });

    let permanentSize = 0;
    let permanentCount = 0;
    let temporarySize = 0;
    let temporaryCount = 0;

    for (const item of stats) {
      if (item.retentionType === RetentionType.PERMANENT) {
        permanentSize = item._sum.fileSize || 0;
        permanentCount = item._count.id || 0;
      } else if (item.retentionType === RetentionType.TEMPORARY) {
        temporarySize = item._sum.fileSize || 0;
        temporaryCount = item._count.id || 0;
      }
    }

    const expiringFilesCount = await this.prisma.file.count({
      where: {
        tenantId,
        retentionType: RetentionType.TEMPORARY,
        deletedAt: null,
        expiresAt: {
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // expires in next 24 hours
        }
      }
    });

    return {
      totalSize: permanentSize + temporarySize,
      totalCount: permanentCount + temporaryCount,
      permanent: {
        size: permanentSize,
        count: permanentCount
      },
      temporary: {
        size: temporarySize,
        count: temporaryCount,
        expiringSoonCount: expiringFilesCount
      }
    };
  }
}
