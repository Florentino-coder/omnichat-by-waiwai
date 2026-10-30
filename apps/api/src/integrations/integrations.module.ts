import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TermwaiClient } from "./termwai.client";
import { TermwaiController } from "./termwai.controller";
import { TermwaiService } from "./termwai.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TermwaiController],
  providers: [TermwaiClient, TermwaiService]
})
export class IntegrationsModule {}
