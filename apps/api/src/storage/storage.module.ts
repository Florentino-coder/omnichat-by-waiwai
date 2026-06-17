import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { StorageController } from "./storage.controller";
import { StorageCleanupService } from "./storage-cleanup.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StorageController],
  providers: [StorageService, StorageCleanupService],
  exports: [StorageService]
})
export class StorageModule {}
