import { IsArray, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf, IsDateString } from "class-validator";

export class BroadcastLineMessageDto {
  @ValidateIf((dto: BroadcastLineMessageDto) => !dto.imageUrl)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class MulticastLineMessageDto {
  @IsArray()
  @IsString({ each: true })
  to!: string[];

  @ValidateIf((dto: MulticastLineMessageDto) => !dto.imageUrl)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
