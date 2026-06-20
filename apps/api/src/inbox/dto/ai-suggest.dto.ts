import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum AiSuggestActionType {
  GENERATE = "generate",
  REWRITE = "rewrite",
  SHORTER = "shorter",
  POLITE = "polite",
  FRIENDLY = "friendly"
}

export class AiSuggestDto {
  @IsEnum(AiSuggestActionType)
  @IsNotEmpty()
  action_type!: AiSuggestActionType;

  @IsString()
  @IsOptional()
  current_text?: string;

  @IsString()
  @IsOptional()
  previous_suggestion_id?: string;
}
