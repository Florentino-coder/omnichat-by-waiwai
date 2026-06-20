import { IsOptional, IsString, MaxLength } from "class-validator";

export class AiTestDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  sample_message?: string;
}
