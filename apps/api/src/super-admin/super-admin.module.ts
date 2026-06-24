import { Module } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { SuperAdminController } from "./super-admin.controller";
import { AiMonitorService } from "./ai-monitor.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BackupModule } from "../backup/backup.module";

@Module({
  imports: [PrismaModule, AuthModule, BackupModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, AiMonitorService]
})
export class SuperAdminModule {}
