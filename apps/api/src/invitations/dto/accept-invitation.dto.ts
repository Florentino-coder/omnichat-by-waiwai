import { IsString, MinLength } from "class-validator";

export class AcceptInvitationDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
