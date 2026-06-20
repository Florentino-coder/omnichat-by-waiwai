import { ConversationPriority } from "@prisma/client";

export const AUTOMATION_STEP_TYPES = [
  "ADD_TAG",
  "ASSIGN_AGENT",
  "SET_PRIORITY",
  "SEND_TEXT_REPLY",
  "SEND_SAVED_REPLY",
  "WAIT",
  "CLOSE_CONVERSATION",
  "ESCALATE"
] as const;

export type AutomationStepType = (typeof AUTOMATION_STEP_TYPES)[number];

export type AutomationStep =
  | { type: "ADD_TAG"; tagName: string }
  | { type: "ASSIGN_AGENT"; memberId: string }
  | { type: "SET_PRIORITY"; priority: ConversationPriority }
  | { type: "SEND_TEXT_REPLY"; text: string }
  | { type: "SEND_SAVED_REPLY"; savedReplyId: string }
  | { type: "WAIT"; delaySeconds: number }
  | { type: "CLOSE_CONVERSATION" }
  | { type: "ESCALATE" };

export type AutomationDispatchContext = {
  messageText?: string;
  tagNames?: string[];
  addedTagName?: string;
  status?: string;
  lineChannelId?: string;
  currentHour: number;
  skipAutomation?: boolean;
};
