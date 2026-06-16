import { IsString, MinLength, Matches } from "class-validator";

export class AcceptInvitationDto {
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "Username can only contain alphanumeric characters, underscores, and hyphens"
  })
  username!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
