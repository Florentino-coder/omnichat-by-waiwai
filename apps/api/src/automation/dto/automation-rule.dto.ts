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
import { AutomationTriggerType } from "@prisma/client";

export class CreateAutomationRuleDto {
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

  @IsEnum(AutomationTriggerType)
  triggerType!: AutomationTriggerType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerTagNames?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  triggerStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  offHourStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  offHourEnd?: number;

  @IsArray()
  steps!: unknown[];
}

export class UpdateAutomationRuleDto {
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
  @IsEnum(AutomationTriggerType)
  triggerType?: AutomationTriggerType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerTagNames?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  triggerStatus?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  offHourStart?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  offHourEnd?: number | null;

  @IsOptional()
  @IsArray()
  steps?: unknown[];
}

export class ListAutomationRulesDto {
  @IsOptional()
  @IsString()
  lineChannelId?: string;
}
