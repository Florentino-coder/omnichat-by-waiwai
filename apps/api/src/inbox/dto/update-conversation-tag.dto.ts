import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateConversationTagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}
