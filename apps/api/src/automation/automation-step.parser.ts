import { BadRequestException } from "@nestjs/common";
import { ConversationPriority } from "@prisma/client";
import {
  AUTOMATION_STEP_TYPES,
  AutomationStep,
  AutomationStepType
} from "./automation-step.types";

const PRIORITY_VALUES = new Set<string>(Object.values(ConversationPriority));

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`Step field "${field}" must be a non-empty string`);
  }
  return value.trim();
}

function readNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BadRequestException(`Step field "${field}" must be an integer`);
  }
  if (value < min || value > max) {
    throw new BadRequestException(
      `Step field "${field}" must be between ${min} and ${max}`
    );
  }
  return value;
}

function parseSingleStep(raw: unknown, index: number): AutomationStep {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestException(`Step ${index + 1} must be an object`);
  }

  const step = raw as Record<string, unknown>;
  const rawType = step.type;
  if (typeof rawType !== "string" || !AUTOMATION_STEP_TYPES.includes(rawType as AutomationStepType)) {
    throw new BadRequestException(
      `Step ${index + 1} has invalid type. Allowed: ${AUTOMATION_STEP_TYPES.join(", ")}`
    );
  }

  const stepType = rawType as AutomationStepType;

  switch (stepType) {
    case "ADD_TAG":
      return { type: stepType, tagName: readString(step.tagName, "tagName") };
    case "ASSIGN_AGENT":
      return { type: stepType, memberId: readString(step.memberId, "memberId") };
    case "SET_PRIORITY": {
      const priority = readString(step.priority, "priority");
      if (!PRIORITY_VALUES.has(priority)) {
        throw new BadRequestException(`Step ${index + 1} has invalid priority`);
      }
      return { type: stepType, priority: priority as ConversationPriority };
    }
    case "SEND_TEXT_REPLY":
      return { type: stepType, text: readString(step.text, "text") };
    case "SEND_SAVED_REPLY":
      return { type: stepType, savedReplyId: readString(step.savedReplyId, "savedReplyId") };
    case "WAIT":
      return {
        type: stepType,
        delaySeconds: readNumber(step.delaySeconds, "delaySeconds", 1, 86400)
      };
    case "CLOSE_CONVERSATION":
      return { type: stepType };
    case "ESCALATE":
      return { type: stepType };
    default:
      throw new BadRequestException(`Step ${index + 1} has unsupported type`);
  }
}

export function parseAutomationSteps(raw: unknown): AutomationStep[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException("steps must be an array");
  }

  if (raw.length === 0) {
    throw new BadRequestException("At least one automation step is required");
  }

  if (raw.length > 20) {
    throw new BadRequestException("Automation rules support at most 20 steps");
  }

  return raw.map((step, index) => parseSingleStep(step, index));
}
