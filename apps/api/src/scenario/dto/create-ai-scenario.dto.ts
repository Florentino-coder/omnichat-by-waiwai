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

export class CreateAiScenarioDto {
  @IsOptional()
  @IsString()
  lineChannelId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

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
  activeHourStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHourEnd?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  instructions!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionAddTagName?: string;

  @IsOptional()
  @IsString()
  actionAssignMemberId?: string;

  @IsOptional()
  @IsEnum(ConversationPriority)
  actionSetPriority?: ConversationPriority;

  @IsOptional()
  @IsBoolean()
  actionEscalate?: boolean;
}
