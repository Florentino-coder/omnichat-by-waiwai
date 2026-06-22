import { IsIn, IsOptional, IsString } from "class-validator";

export class AiSummaryDto {
  @IsString()
  @IsOptional()
  @IsIn(["th", "en"])
  locale?: string;
}
