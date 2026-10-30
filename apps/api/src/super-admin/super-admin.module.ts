import { Module } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { SuperAdminController } from "./super-admin.controller";
import { AiMonitorService } from "./ai-monitor.service";
import { AiModule } from "../ai/ai.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsAdminService } from "./integrations-admin.service";
import { BackupModule } from "../backup/backup.module";

@Module({
  imports: [PrismaModule, AuthModule, BackupModule, AiModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, AiMonitorService, IntegrationsAdminService]
})
export class SuperAdminModule {}
