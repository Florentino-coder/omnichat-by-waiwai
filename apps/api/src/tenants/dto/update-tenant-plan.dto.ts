import { IsIn } from "class-validator";

export class UpdateTenantPlanDto {
  @IsIn(["free", "starter", "pro", "enterprise"])
  planId!: string;
}
