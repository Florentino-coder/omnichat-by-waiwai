export type SettingsTab =
  | "channels"
  | "replies"
  | "knowledge"
  | "scenarios"
  | "automation"
  | "team"
  | "profile"
  | "ai"
  | "ai-curation";

export type WorkspaceRole = "OWNER" | "ADMIN" | "AGENT" | "QC" | "VIEWER";

const SETTINGS_TABS: SettingsTab[] = [
  "channels",
  "replies",
  "knowledge",
  "scenarios",
  "automation",
  "team",
  "profile",
  "ai",
  "ai-curation"
];

const TAB_ROLES: Record<SettingsTab, WorkspaceRole[]> = {
  channels: ["OWNER", "ADMIN"],
  replies: ["OWNER", "ADMIN", "AGENT"],
  knowledge: ["OWNER", "ADMIN", "AGENT", "QC"],
  scenarios: ["OWNER", "ADMIN", "AGENT", "QC", "VIEWER"],
  automation: ["OWNER", "ADMIN", "AGENT", "QC", "VIEWER"],
  team: ["OWNER", "ADMIN"],
  profile: ["OWNER", "ADMIN", "AGENT", "QC", "VIEWER"],
  ai: ["OWNER", "ADMIN"],
  "ai-curation": ["OWNER", "ADMIN", "QC"]
};

export function isSettingsTab(value: string | null | undefined): value is SettingsTab {
  return Boolean(value && SETTINGS_TABS.includes(value as SettingsTab));
}

export function canAccessSettingsTab(tab: SettingsTab, role: string | null): boolean {
  if (!role) {
    return tab === "profile" || tab === "replies";
  }
  return TAB_ROLES[tab].includes(role as WorkspaceRole);
}

export function defaultSettingsTab(role: string | null): SettingsTab {
  if (!role) {
    return "profile";
  }
  if (role === "OWNER" || role === "ADMIN") {
    return "channels";
  }
  if (role === "QC" || role === "VIEWER") {
    return "profile";
  }
  return "replies";
}

export function resolveSettingsTab(tabParam: string | null, role: string | null): SettingsTab {
  if (isSettingsTab(tabParam) && canAccessSettingsTab(tabParam, role)) {
    return tabParam;
  }
  return defaultSettingsTab(role);
}
