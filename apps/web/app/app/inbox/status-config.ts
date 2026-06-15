export const STATUS_CONFIG = {
  OPEN: {
    label: "OPEN",
    className: "border-success bg-success-soft text-success hover:bg-success-soft"
  },
  IN_PROGRESS: {
    label: "In progress",
    className: "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
  },
  RESOLVED: {
    label: "Resolved",
    className: "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
  }
} as const;

export type StatusConfigKey = keyof typeof STATUS_CONFIG;
