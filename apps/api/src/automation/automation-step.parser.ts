import { BadRequestException } from "@nestjs/common";
import { ConversationPriority } from "@prisma/client";
import {
  AUTOMATION_STEP_TYPES,
  AutomationStep,
  AutomationStepType,
  StepRunAfter
} from "./automation-step.types";

const PRIORITY_VALUES = new Set<string>(Object.values(ConversationPriority));
const RUN_AFTER_VALUES = new Set<StepRunAfter>(["immediate", "customer_reply"]);
const IMAGE_URL_PATTERN = /^https?:\/\/.+/i;

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

function readImageUrl(value: unknown, stepNumber: number): string {
  const imageUrl = readString(value, "imageUrl");
  if (!IMAGE_URL_PATTERN.test(imageUrl)) {
    throw new BadRequestException(
      `Step ${stepNumber} imageUrl must be an http or https URL`
    );
  }
  return imageUrl;
}

function readRunAfter(value: unknown, index: number): StepRunAfter | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !RUN_AFTER_VALUES.has(value as StepRunAfter)) {
    throw new BadRequestException(
      `Step ${index + 1} runAfter must be "immediate" or "customer_reply"`
    );
  }
  if (index === 0) {
    throw new BadRequestException(`Step 1 cannot use runAfter`);
  }
  return value as StepRunAfter;
}

function attachRunAfter<T extends AutomationStep>(
  step: T,
  runAfter: StepRunAfter | undefined
): T {
  if (!runAfter) {
    return step;
  }
  return { ...step, runAfter };
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
  const runAfter = readRunAfter(step.runAfter, index);

  switch (stepType) {
    case "ADD_TAG":
      return attachRunAfter({ type: stepType, tagName: readString(step.tagName, "tagName") }, runAfter);
    case "ASSIGN_AGENT":
      return attachRunAfter(
        { type: stepType, memberId: readString(step.memberId, "memberId") },
        runAfter
      );
    case "SET_PRIORITY": {
      const priority = readString(step.priority, "priority");
      if (!PRIORITY_VALUES.has(priority)) {
        throw new BadRequestException(`Step ${index + 1} has invalid priority`);
      }
      return attachRunAfter(
        { type: stepType, priority: priority as ConversationPriority },
        runAfter
      );
    }
    case "SEND_TEXT_REPLY":
      return attachRunAfter(
        { type: stepType, text: readString(step.text, "text") },
        runAfter
      );
    case "SEND_IMAGE_REPLY":
      return attachRunAfter(
        {
          type: stepType,
          imageUrl: readImageUrl(step.imageUrl, index + 1)
        },
        runAfter
      );
    case "SEND_SAVED_REPLY":
      return attachRunAfter(
        { type: stepType, savedReplyId: readString(step.savedReplyId, "savedReplyId") },
        runAfter
      );
    case "WAIT":
      return attachRunAfter(
        {
          type: stepType,
          delaySeconds: readNumber(step.delaySeconds, "delaySeconds", 1, 86400)
        },
        runAfter
      );
    case "CLOSE_CONVERSATION":
      return attachRunAfter({ type: stepType }, runAfter);
    case "ESCALATE":
      return attachRunAfter({ type: stepType }, runAfter);
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
