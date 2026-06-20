import { IsEnum, IsNotEmpty } from "class-validator";

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
}
