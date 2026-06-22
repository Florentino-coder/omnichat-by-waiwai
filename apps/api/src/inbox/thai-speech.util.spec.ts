import { AiAgentGender } from "@prisma/client";
import {
  buildAgentGenderInstruction,
  normalizeThaiPoliteParticles
} from "./thai-speech.util";

describe("thai-speech.util", () => {
  describe("buildAgentGenderInstruction", () => {
    it("returns female particle rules for FEMALE gender", () => {
      const instruction = buildAgentGenderInstruction(AiAgentGender.FEMALE);
      expect(instruction).toContain("ผู้หญิง");
      expect(instruction).toContain("นะคะ");
      expect(instruction).toContain("ห้ามเขียนแบบ ค่ะ/ครับ");
    });

    it("returns male particle rules for MALE gender", () => {
      const instruction = buildAgentGenderInstruction(AiAgentGender.MALE);
      expect(instruction).toContain("ผู้ชาย");
      expect(instruction).toContain("นะครับ");
      expect(instruction).toContain("ห้ามเขียนแบบ ค่ะ/ครับ");
    });
  });

  describe("normalizeThaiPoliteParticles", () => {
    it("replaces dual female/male particles with female form", () => {
      const input =
        "สบายดีค่ะ/ครับ ขอบคุณที่ถามนะคะ/นะครับ ไม่ทราบว่ายังติดปัญหาเดิมอยู่ไหมคะ/ครับ";
      const result = normalizeThaiPoliteParticles(input, AiAgentGender.FEMALE);
      expect(result).toBe(
        "สบายดีค่ะ ขอบคุณที่ถามนะคะ ไม่ทราบว่ายังติดปัญหาเดิมอยู่ไหมคะ"
      );
    });

    it("replaces dual female/male particles with male form", () => {
      const input = "สบายดีค่ะ/ครับ ขอบคุณที่ถามนะคะ/นะครับ";
      const result = normalizeThaiPoliteParticles(input, AiAgentGender.MALE);
      expect(result).toBe("สบายดีครับ ขอบคุณที่ถามนะครับ");
    });

    it("converts stray male particles to female when gender is female", () => {
      const result = normalizeThaiPoliteParticles("รับทราบครับ", AiAgentGender.FEMALE);
      expect(result).toBe("รับทราบค่ะ");
    });

    it("converts stray female particles to male when gender is male", () => {
      const result = normalizeThaiPoliteParticles("รับทราบค่ะ", AiAgentGender.MALE);
      expect(result).toBe("รับทราบครับ");
    });
  });

  describe("formatMessagesForLlm", () => {
    const { formatMessagesForLlm } = require("./thai-speech.util");

    it("maps INBOUND to customer role and OUTBOUND to agent role", () => {
      const messages = [
        { direction: "INBOUND" as const, text: "Hello" },
        { direction: "OUTBOUND" as const, text: "Hi there" }
      ];
      const result = formatMessagesForLlm(messages);
      expect(result).toEqual([
        { role: "customer", text: "Hello" },
        { role: "agent", text: "Hi there" }
      ]);
    });

    it("uses [Media/Attachment] placeholder for null, undefined, empty, or whitespace text", () => {
      const messages = [
        { direction: "INBOUND" as const, text: "" },
        { direction: "INBOUND" as const, text: "   " },
        { direction: "INBOUND" as const, text: null },
        { direction: "OUTBOUND" as const, text: undefined }
      ];
      const result = formatMessagesForLlm(messages);
      expect(result).toEqual([
        { role: "customer", text: "[Media/Attachment]" },
        { role: "customer", text: "[Media/Attachment]" },
        { role: "customer", text: "[Media/Attachment]" },
        { role: "agent", text: "[Media/Attachment]" }
      ]);
    });
  });
});
