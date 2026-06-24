import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QaController } from "./qa.controller";
import { QaService } from "./qa.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [QaController],
  providers: [QaService],
  exports: [QaService]
})
export class QaModule {}
