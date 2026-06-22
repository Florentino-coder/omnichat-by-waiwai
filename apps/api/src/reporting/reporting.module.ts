import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
