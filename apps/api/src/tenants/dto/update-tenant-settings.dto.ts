import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  defaultLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enableTwoFa?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxAgents?: number;
}
