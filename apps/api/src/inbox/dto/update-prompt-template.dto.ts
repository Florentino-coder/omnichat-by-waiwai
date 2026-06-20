import { IsNotEmpty, IsString } from "class-validator";

export class UpdatePromptTemplateDto {
  @IsString()
  @IsNotEmpty()
  systemPrompt!: string;
}
