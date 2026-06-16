import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantsController } from "./tenants.controller";
import { TenantSetupController } from "./tenant-setup.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [AuthModule],
  controllers: [TenantsController, TenantSetupController],
  providers: [TenantsService],
  exports: [TenantsService]
})
export class TenantsModule {}
