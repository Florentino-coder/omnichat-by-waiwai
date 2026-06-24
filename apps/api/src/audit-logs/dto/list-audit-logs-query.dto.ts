import { AuditAction } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min
} from "class-validator";
import { AUDIT_LOG_CATEGORIES } from "../audit-action-categories";

export class ListAuditLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsIn(AUDIT_LOG_CATEGORIES)
  category?: (typeof AUDIT_LOG_CATEGORIES)[number];

  @IsOptional()
  @IsUUID("4")
  userId?: string;
}
