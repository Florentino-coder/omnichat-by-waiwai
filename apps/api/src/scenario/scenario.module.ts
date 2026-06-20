import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ScenarioController } from "./scenario.controller";
import { ScenarioService } from "./scenario.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ScenarioController],
  providers: [ScenarioService],
  exports: [ScenarioService]
})
export class ScenarioModule {}
