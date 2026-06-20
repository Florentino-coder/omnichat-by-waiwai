import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum AiSuggestionStatus {
  SHOWN = "shown",
  EDITED = "edited",
  SENT = "sent",
  REJECTED = "rejected",
  SUPERSEDED = "superseded"
}

export class UpdateAiSuggestionDto {
  @IsEnum(AiSuggestionStatus)
  @IsNotEmpty()
  status!: AiSuggestionStatus;

  @IsString()
  @IsOptional()
  final_sent_text?: string;
}
