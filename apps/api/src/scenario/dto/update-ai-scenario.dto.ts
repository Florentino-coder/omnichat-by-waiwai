import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { ConversationPriority } from "@prisma/client";

export class UpdateAiScenarioDto {
  @IsOptional()
  @IsString()
  lineChannelId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerTagNames?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHourStart?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHourEnd?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionAddTagName?: string | null;

  @IsOptional()
  @IsString()
  actionAssignMemberId?: string | null;

  @IsOptional()
  @IsEnum(ConversationPriority)
  actionSetPriority?: ConversationPriority | null;

  @IsOptional()
  @IsBoolean()
  actionEscalate?: boolean;
}
