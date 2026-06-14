import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateConversationTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}
