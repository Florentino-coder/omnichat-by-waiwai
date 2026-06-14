import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateSavedReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
