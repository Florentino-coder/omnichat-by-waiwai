import { IsIn } from "class-validator";

export type ConversationPriorityValue = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export class UpdateConversationPriorityDto {
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority!: ConversationPriorityValue;
}
