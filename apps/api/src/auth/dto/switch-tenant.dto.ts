import { IsString, IsUUID } from "class-validator";

export class SwitchTenantDto {
  @IsString()
  @IsUUID()
  workspaceId!: string;
}
