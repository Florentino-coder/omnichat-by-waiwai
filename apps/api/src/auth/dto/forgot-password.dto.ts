import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  identifier!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
