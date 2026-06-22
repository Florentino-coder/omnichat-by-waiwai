import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AiAutoReplyMode } from "@prisma/client";
import { UpdateInboxSettingsDto } from "./update-inbox-settings.dto";

async function validateDto(input: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdateInboxSettingsDto, input);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe("UpdateInboxSettingsDto", () => {
  it("accepts valid AI auto-reply settings", async () => {
    const errors = await validateDto({
      enableAiAutoReply: true,
      enableHybridAutoDraft: false,
      aiAutoReplyMode: AiAutoReplyMode.OFF_HOURS_ONLY,
      aiAutoReplyBusinessHourStart: 8,
      aiAutoReplyBusinessHourEnd: 23,
      aiAutoReplyInstructions: "ตอบสุภาพและกระชับ",
      aiEscalationKeywords: ["แอดมิน", "คุยกับคน"]
    });

    expect(errors).toHaveLength(0);
  });

  it("rejects invalid business hour values", async () => {
    const errors = await validateDto({
      aiAutoReplyBusinessHourStart: 24,
      aiAutoReplyBusinessHourEnd: -1
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects too many escalation keywords", async () => {
    const errors = await validateDto({
      aiEscalationKeywords: Array.from({ length: 21 }, (_, index) => `keyword-${index}`)
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid auto-reply mode", async () => {
    const errors = await validateDto({
      aiAutoReplyMode: "INVALID_MODE"
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects auto-reply instructions over 2000 chars", async () => {
    const errors = await validateDto({
      aiAutoReplyInstructions: "x".repeat(2001)
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts valid confidence threshold values", async () => {
    const errors = await validateDto({
      aiAutoReplyConfidenceThreshold: 0.85
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid confidence threshold values", async () => {
    const errors = await validateDto({
      aiAutoReplyConfidenceThreshold: 1.1
    });
    expect(errors.length).toBeGreaterThan(0);

    const errors2 = await validateDto({
      aiAutoReplyConfidenceThreshold: -0.1
    });
    expect(errors2.length).toBeGreaterThan(0);
  });
});
