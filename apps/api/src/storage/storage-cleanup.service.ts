import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "./storage.service";
import { RetentionType } from "@prisma/client";

@Injectable()
export class StorageCleanupService {
  private readonly logger = new Logger(StorageCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  // Daily 02:30 Bangkok (19:30 UTC)
  @Cron("30 19 * * *")
  async cleanupExpiredFiles() {
    this.logger.log("Starting daily cleanup of expired temporary files...");
    try {
      const expiredFiles = await this.prisma.file.findMany({
        where: {
          retentionType: RetentionType.TEMPORARY,
          expiresAt: {
            lt: new Date()
          },
          deletedAt: null
        }
      });

      this.logger.log(`Found ${expiredFiles.length} expired files to soft-delete.`);

      for (const file of expiredFiles) {
        await this.prisma.file.update({
          where: { id: file.id },
          data: { deletedAt: new Date() }
        });
      }

      this.logger.log("Expired temporary files cleanup completed.");
    } catch (err) {
      this.logger.error("Error cleaning up expired temporary files:", err);
    }
  }

  // Daily 03:30 Bangkok (20:30 UTC)
  @Cron("30 20 * * *")
  async cleanupTrash() {
    this.logger.log("Starting daily hard-deletion of soft-deleted files...");
    try {
      // Find files soft deleted more than 24 hours ago
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const trashFiles = await this.prisma.file.findMany({
        where: {
          deletedAt: {
            lt: cutoff
          }
        }
      });

      this.logger.log(`Found ${trashFiles.length} files in trash to permanently delete.`);

      for (const file of trashFiles) {
        await this.storageService.deleteFile(file.tenantId, file.id);
        await this.prisma.file.delete({
          where: { id: file.id }
        });
      }

      this.logger.log("Trash cleanup completed.");
    } catch (err) {
      this.logger.error("Error cleaning up trash:", err);
    }
  }

  // Daily 02:00 Bangkok (19:00 UTC)
  @Cron("0 19 * * *")
  async cleanupAvatars() {
    this.logger.log("Starting daily cleanup of conversation avatars from R2...");
    try {
      const avatarFiles = await this.prisma.file.findMany({
        where: {
          fileName: {
            startsWith: "avatar_"
          },
          deletedAt: null
        }
      });

      this.logger.log(`Found ${avatarFiles.length} avatar files to delete.`);

      for (const file of avatarFiles) {
        try {
          await this.storageService.deleteFile(file.tenantId, file.id);
          // Hard delete from database
          await this.prisma.file.delete({
            where: { id: file.id }
          });
        } catch (err) {
          this.logger.error(`Failed to delete avatar file ${file.id}: ${err instanceof Error ? err.message : err}`);
        }

        // Reset conversation pictureUrl to null
        if (file.conversationId) {
          await this.prisma.conversation.update({
            where: { id: file.conversationId },
            data: { pictureUrl: null }
          });
        }
      }

      this.logger.log("Conversation avatars cleanup completed.");
    } catch (err) {
      this.logger.error("Error during daily cleanup of conversation avatars:", err);
    }
  }
}
