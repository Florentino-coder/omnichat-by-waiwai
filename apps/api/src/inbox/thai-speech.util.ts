import { AiAgentGender } from "@prisma/client";

export const AI_SUGGEST_USAGE_METRIC = "ai_suggest";

export function buildAgentGenderInstruction(gender: AiAgentGender): string {
  if (gender === AiAgentGender.MALE) {
    return `เพศของแอดมิน (ผู้ตอบ): ผู้ชาย
- ใช้คำลงท้ายผู้ชายเท่านั้น: ครับ, นะครับ
- ห้ามใช้ ค่ะ, คะ, นะคะ, นะค่
- ห้ามเขียนแบบ ค่ะ/ครับ หรือ นะคะ/นะครับ หรือรูปแบบที่มี "/" ระหว่างคำลงท้าย
- ตัวอย่าง: "สบายดีครับ ขอบคุณที่ถามนะครับ"`;
  }

  return `เพศของแอดมิน (ผู้ตอบ): ผู้หญิง
- ใช้คำลงท้ายผู้หญิงเท่านั้น: ค่ะ, คะ, นะคะ, นะค่
- ห้ามใช้ ครับ หรือ นะครับ
- ห้ามเขียนแบบ ค่ะ/ครับ หรือ นะคะ/นะครับ หรือรูปแบบที่มี "/" ระหว่างคำลงท้าย
- ตัวอย่าง: "สบายดีค่ะ ขอบคุณที่ถามนะคะ"`;
}

const DUAL_PARTICLE_PATTERNS: Array<{ pattern: RegExp; female: string; male: string }> = [
  { pattern: /นะคะ\s*\/\s*นะครับ/g, female: "นะคะ", male: "นะครับ" },
  { pattern: /นะค่\s*\/\s*นะครับ/g, female: "นะค่", male: "นะครับ" },
  { pattern: /ค่ะ\s*\/\s*ครับ/g, female: "ค่ะ", male: "ครับ" },
  { pattern: /คะ\s*\/\s*ครับ/g, female: "คะ", male: "ครับ" },
  { pattern: /ครับ\s*\/\s*ค่ะ/g, female: "ค่ะ", male: "ครับ" },
  { pattern: /นะครับ\s*\/\s*นะคะ/g, female: "นะคะ", male: "นะครับ" }
];

export function normalizeThaiPoliteParticles(text: string, gender: AiAgentGender): string {
  let normalized = text.trim();

  for (const { pattern, female, male } of DUAL_PARTICLE_PATTERNS) {
    normalized = normalized.replace(pattern, gender === AiAgentGender.MALE ? male : female);
  }

  if (gender === AiAgentGender.MALE) {
    normalized = normalized
      .replace(/นะคะ/g, "นะครับ")
      .replace(/นะค่/g, "นะครับ")
      .replace(/ค่ะ/g, "ครับ")
      .replace(/คะ(?![\u0E00-\u0E7F])/g, "ครับ");
  } else {
    normalized = normalized
      .replace(/นะครับ/g, "นะคะ")
      .replace(/ครับ/g, "ค่ะ");
  }

  return normalized;
}

export function getCurrentMonthUsagePeriod(now = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}

export function formatMessagesForLlm(
  messages: Array<{ direction: "INBOUND" | "OUTBOUND"; text?: string | null }>
): { role: "customer" | "agent"; text: string }[] {
  return messages.map((msg) => ({
    role: msg.direction === "INBOUND" ? ("customer" as const) : ("agent" as const),
    text: msg.text?.trim() ? msg.text : "[Media/Attachment]"
  }));
}
