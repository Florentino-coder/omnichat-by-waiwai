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

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  shortcutKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  hotkeyBinding?: string;
}
