import { Module } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { SuperAdminController } from "./super-admin.controller";
import { AiMonitorService } from "./ai-monitor.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, AiMonitorService]
})
export class SuperAdminModule {}
