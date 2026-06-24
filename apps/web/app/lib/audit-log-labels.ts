import type { Locale } from "./i18n";

export const AUDIT_LOG_CATEGORIES = [
  "auth",
  "conversation",
  "ai",
  "knowledge",
  "automation",
  "line",
  "settings",
  "backup"
] as const;

export type AuditLogCategory = (typeof AUDIT_LOG_CATEGORIES)[number];

const CATEGORY_LABELS: Record<Locale, Record<AuditLogCategory, string>> = {
  th: {
    auth: "เข้าสู่ระบบ & ความปลอดภัย",
    conversation: "การสนทนา",
    ai: "AI",
    knowledge: "คลังความรู้",
    automation: "Automation",
    line: "LINE",
    settings: "ตั้งค่าระบบ",
    backup: "สำรองข้อมูล"
  },
  en: {
    auth: "Auth & security",
    conversation: "Conversations",
    ai: "AI",
    knowledge: "Knowledge",
    automation: "Automation",
    line: "LINE",
    settings: "Settings",
    backup: "Backup"
  }
};

const ACTION_LABELS: Record<Locale, Partial<Record<string, string>>> = {
  th: {
    LOGIN: "เข้าสู่ระบบ",
    LOGOUT: "ออกจากระบบ",
    AI_AUTO_REPLY_SENT: "AI ตอบอัตโนมัติ",
    AI_AUTO_REPLY_ESCALATED: "AI ส่งต่อคน",
    AI_AUTO_REPLY_SKIPPED: "AI ข้ามการตอบ",
    AI_AUTO_REPLY_FAILED: "AI ตอบไม่สำเร็จ",
    AUTOMATION_AI_REPLY_SENT: "Automation AI ตอบ",
    AI_POLICY_BLOCKED: "AI ถูกบล็อกนโยบาย",
    AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL: "Guardrail ปิด AI auto-reply",
    AI_SUGGEST_GENERATED: "AI ร่างคำตอบ",
    AI_SUGGEST_SENT: "ส่งคำตอบ AI",
    LINE_REPLY_SENT: "ส่งข้อความ LINE",
    LINE_MESSAGE_RECEIVED: "รับข้อความ LINE",
    CONVERSATION_ASSIGNED: "มอบหมายแชท",
    CONVERSATION_STATUS_CHANGED: "เปลี่ยนสถานะแชท",
    INBOX_SETTINGS_UPDATED: "อัปเดตตั้งค่า Inbox",
    LINE_BROADCAST_CANCELLED: "ยกเลิกบรอดแคสต์",
    LINE_BROADCAST_DELETED: "ลบบรอดแคสต์"
  },
  en: {
    LOGIN: "Login",
    LOGOUT: "Logout",
    AI_AUTO_REPLY_SENT: "AI auto-reply sent",
    AI_AUTO_REPLY_ESCALATED: "AI escalated to human",
    AI_AUTO_REPLY_SKIPPED: "AI auto-reply skipped",
    AI_AUTO_REPLY_FAILED: "AI auto-reply failed",
    AUTOMATION_AI_REPLY_SENT: "Automation AI reply",
    AI_POLICY_BLOCKED: "AI policy blocked",
    AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL: "Guardrail disabled auto-reply",
    AI_SUGGEST_GENERATED: "AI suggestion generated",
    AI_SUGGEST_SENT: "AI suggestion sent",
    LINE_REPLY_SENT: "LINE reply sent",
    LINE_MESSAGE_RECEIVED: "LINE message received",
    CONVERSATION_ASSIGNED: "Conversation assigned",
    CONVERSATION_STATUS_CHANGED: "Conversation status changed",
    INBOX_SETTINGS_UPDATED: "Inbox settings updated",
    LINE_BROADCAST_CANCELLED: "Broadcast cancelled",
    LINE_BROADCAST_DELETED: "Broadcast deleted"
  }
};

export function getAuditCategoryLabel(category: AuditLogCategory, locale: Locale): string {
  return CATEGORY_LABELS[locale][category];
}

export function formatAuditAction(action: string, locale: Locale): string {
  return ACTION_LABELS[locale][action] ?? action.replace(/_/g, " ");
}

export function summarizeMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }
  const record = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.reason === "string") {
    parts.push(record.reason);
  }
  if (typeof record.mode === "string") {
    parts.push(record.mode);
  }
  if (Array.isArray(record.matchedKeywords) && record.matchedKeywords.length > 0) {
    parts.push(String(record.matchedKeywords.join(", ")));
  }
  return parts.join(" · ").slice(0, 120);
}
