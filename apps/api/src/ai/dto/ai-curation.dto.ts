import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export enum TrainingPairStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export class ListAiCurationDto {
  @IsOptional()
  @IsEnum(TrainingPairStatus)
  status?: TrainingPairStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class UpdateAiTrainingPairDto {
  @IsOptional()
  @IsString()
  customerMessage?: string;

  @IsOptional()
  @IsString()
  assistantReply?: string;

  @IsOptional()
  @IsEnum(TrainingPairStatus)
  status?: TrainingPairStatus;
}

export class ApproveAiTrainingPairDto {
  @IsOptional()
  @IsBoolean()
  global?: boolean = false;
}
