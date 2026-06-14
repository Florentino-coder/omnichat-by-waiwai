import { IsIn } from "class-validator";

export const conversationStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];

export class UpdateConversationStatusDto {
  @IsIn(conversationStatuses)
  status!: ConversationStatus;
}
