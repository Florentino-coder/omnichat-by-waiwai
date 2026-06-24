import { Module } from "@nestjs/common";
import { BackupService } from "./backup.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [BackupService],
  exports: [BackupService]
})
export class BackupModule {}
