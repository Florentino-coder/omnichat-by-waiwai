import { IsOptional, IsString } from "class-validator";

export class AssignConversationDto {
  @IsOptional()
  @IsString()
  memberId?: string | null;
}
