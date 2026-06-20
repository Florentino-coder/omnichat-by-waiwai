import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateInboxSettingsDto {
  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  inProgressAlertMinutes?: number;

  @IsBoolean()
  @IsOptional()
  enableAiSuggest?: boolean;

  @IsEnum(["gemini", "openai", "claude"])
  @IsOptional()
  aiProvider?: string;
}
