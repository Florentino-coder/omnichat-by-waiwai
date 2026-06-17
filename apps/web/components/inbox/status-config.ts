export const STATUS_CONFIG = {
  OPEN: {
    dot: "#20A77A",
    text: "เปิดอยู่",
    bg: "#EFFFF8",
    border: "#8DEBC8",
    avatarText: "#08704F",
    className: "border-success bg-success-soft text-success hover:bg-success-soft"
  },
  PENDING: {
    dot: "#E49A27",
    text: "รอแอดมิน",
    bg: "#FFF7E8",
    border: "#F6C879",
    avatarText: "#955C08",
    className: "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
  },
  IN_PROGRESS: {
    dot: "#20A77A",
    text: "เปิดอยู่",
    bg: "#EFFFF8",
    border: "#8DEBC8",
    avatarText: "#08704F",
    className: "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
  },
  RESOLVED: {
    dot: "#9A9DB0",
    text: "ปิดแล้ว",
    bg: "#F5F4EF",
    border: "#D8D6CC",
    avatarText: "#71717A",
    className: "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
  },
  UNREAD: {
    dot: "#EF4444",
    text: "ยังไม่ได้อ่าน",
    bg: "#FEE2E2",
    border: "#FCA5A5",
    avatarText: "#991B1B",
    className: "border-red-400 bg-red-50 text-red-700 hover:bg-red-100"
  }
} as const;

export type ConvStatus = keyof typeof STATUS_CONFIG;
