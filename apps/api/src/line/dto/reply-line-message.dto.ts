import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from "class-validator";

export class ReplyLineMessageDto {
  @ValidateIf((dto: ReplyLineMessageDto) => !dto.imageUrl)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(2048)
  imageUrl?: string;
}
