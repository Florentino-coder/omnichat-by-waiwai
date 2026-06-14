import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSavedReplyDto {
  @IsOptional()
  @IsString()
  lineChannelId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
