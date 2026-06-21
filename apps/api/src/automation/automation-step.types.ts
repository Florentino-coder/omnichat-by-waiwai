import { ConversationPriority } from "@prisma/client";

export const AUTOMATION_STEP_TYPES = [
  "ADD_TAG",
  "ASSIGN_AGENT",
  "SET_PRIORITY",
  "SEND_TEXT_REPLY",
  "SEND_IMAGE_REPLY",
  "SEND_SAVED_REPLY",
  "WAIT",
  "CLOSE_CONVERSATION",
  "ESCALATE"
] as const;

export type AutomationStepType = (typeof AUTOMATION_STEP_TYPES)[number];

export type StepRunAfter = "immediate" | "customer_reply";

type StepWithRunAfter<T> = T & { runAfter?: StepRunAfter };

export type AutomationStep =
  | StepWithRunAfter<{ type: "ADD_TAG"; tagName: string }>
  | StepWithRunAfter<{ type: "ASSIGN_AGENT"; memberId: string }>
  | StepWithRunAfter<{ type: "SET_PRIORITY"; priority: ConversationPriority }>
  | StepWithRunAfter<{ type: "SEND_TEXT_REPLY"; text: string }>
  | StepWithRunAfter<{ type: "SEND_IMAGE_REPLY"; imageUrl: string }>
  | StepWithRunAfter<{ type: "SEND_SAVED_REPLY"; savedReplyId: string }>
  | StepWithRunAfter<{ type: "WAIT"; delaySeconds: number }>
  | StepWithRunAfter<{ type: "CLOSE_CONVERSATION" }>
  | StepWithRunAfter<{ type: "ESCALATE" }>;

export type AutomationDispatchContext = {
  messageText?: string;
  tagNames?: string[];
  addedTagName?: string;
  status?: string;
  lineChannelId?: string;
  currentHour: number;
  skipAutomation?: boolean;
  skipRuleIds?: string[];
  inboundMessageId?: string;
};

export function getStepRunAfter(step: AutomationStep, stepIndex: number): StepRunAfter {
  if (stepIndex === 0) {
    return "immediate";
  }
  return step.runAfter ?? "immediate";
}

export function shouldWaitForCustomerReply(step: AutomationStep, stepIndex: number): boolean {
  return getStepRunAfter(step, stepIndex) === "customer_reply";
}
