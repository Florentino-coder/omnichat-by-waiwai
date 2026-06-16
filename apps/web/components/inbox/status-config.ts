export const STATUS_CONFIG = {
  OPEN: {
    dot: "#1F9D72",
    text: "เปิดอยู่",
    bg: "#ECFDF5",
    border: "#6EE7B7",
    avatarText: "#065F46",
    className: "border-success bg-success-soft text-success hover:bg-success-soft"
  },
  PENDING: {
    dot: "#D97706",
    text: "รอแอดมิน",
    bg: "#FFFBEB",
    border: "#FCD34D",
    avatarText: "#92400E",
    className: "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
  },
  IN_PROGRESS: {
    dot: "#1F9D72",
    text: "กำลังดำเนินการ",
    bg: "#ECFDF5",
    border: "#6EE7B7",
    avatarText: "#065F46",
    className: "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
  },
  RESOLVED: {
    dot: "#9A9DB0",
    text: "ปิดแล้ว",
    bg: "var(--bg-base)",
    border: "var(--border)",
    avatarText: "var(--text-secondary)",
    className: "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
  }
} as const;

export type ConvStatus = keyof typeof STATUS_CONFIG;
