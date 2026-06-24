import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { AiAgentGender, AiAutoReplyMode } from "@prisma/client";

export class UpdateInboxSettingsDto {
  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  inProgressAlertMinutes?: number;

  @IsBoolean()
  @IsOptional()
  enableAiSuggest?: boolean;

  @IsBoolean()
  @IsOptional()
  enableHybridAutoDraft?: boolean;

  @IsBoolean()
  @IsOptional()
  enableAiScenarios?: boolean;

  @IsEnum(["gemini", "openai", "claude"])
  @IsOptional()
  aiProvider?: string;

  @IsEnum(AiAgentGender)
  @IsOptional()
  aiAgentGender?: AiAgentGender;

  @IsBoolean()
  @IsOptional()
  enableAiAutoReply?: boolean;

  @IsEnum(AiAutoReplyMode)
  @IsOptional()
  aiAutoReplyMode?: AiAutoReplyMode;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  aiAutoReplyBusinessHourStart?: number;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  aiAutoReplyBusinessHourEnd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aiAutoReplyInstructions?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  aiEscalationKeywords?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  aiAutoReplyConfidenceThreshold?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  aiPolicyBlockedTopics?: string[];
}
