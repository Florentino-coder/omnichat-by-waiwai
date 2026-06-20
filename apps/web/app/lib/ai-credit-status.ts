export type AiCreditBlockReason = "PLAN_EXCLUDES_AI" | "MONTHLY_LIMIT_REACHED";

export function getAiCreditStatusMessage(
  blockReason: AiCreditBlockReason | null | undefined
): string | null {
  if (blockReason === "PLAN_EXCLUDES_AI") {
    return "แผนปัจจุบันยังไม่เปิดโควต้า AI (0 ครั้ง) ติดต่อผู้ดูแลระบบเพื่ออัปเกรดแผน";
  }
  if (blockReason === "MONTHLY_LIMIT_REACHED") {
    return "ใช้โควต้า AI ครบแล้วในรอบเดือนนี้ รอรอบ billing ถัดไปหรือติดต่อผู้ดูแลระบบ";
  }
  return null;
}

export function getAiCreditErrorMessage(message: string): string | null {
  if (
    message.includes("not available on the current plan") ||
    message.includes("PLAN_EXCLUDES_AI")
  ) {
    return getAiCreditStatusMessage("PLAN_EXCLUDES_AI");
  }
  if (
    message.includes("Monthly AI credit limit exceeded") ||
    message.includes("MONTHLY_LIMIT_REACHED")
  ) {
    return getAiCreditStatusMessage("MONTHLY_LIMIT_REACHED");
  }
  if (message.includes("PLAN_LIMIT_EXCEEDED")) {
    return "โควต้า AI ไม่พร้อมใช้งาน ตรวจสอบแผนและการใช้งานใน Settings > AI";
  }
  return null;
}
