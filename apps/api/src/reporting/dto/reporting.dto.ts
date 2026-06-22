import { IsOptional, IsDateString } from "class-validator";

export class GetReportingQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
