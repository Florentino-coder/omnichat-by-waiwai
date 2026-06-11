import { IsEmail, IsEnum, IsString } from "class-validator";
import { Role } from "@prisma/client";

export class CreateInvitationDto {
  @IsString()
  workspaceId!: string;

  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}
