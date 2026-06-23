import {
  canAccessSettingsTab,
  defaultSettingsTab,
  resolveSettingsTab
} from "../app/lib/settings-rbac";

describe("settings RBAC", () => {
  it("defaults to profile when role is unknown", () => {
    expect(defaultSettingsTab(null)).toBe("profile");
  });

  it("blocks privileged tabs until role is confirmed", () => {
    expect(canAccessSettingsTab("channels", null)).toBe(false);
    expect(canAccessSettingsTab("team", null)).toBe(false);
    expect(canAccessSettingsTab("profile", null)).toBe(true);
  });

  it("rejects tab params that exceed the user role", () => {
    expect(resolveSettingsTab("team", "AGENT")).toBe("replies");
    expect(resolveSettingsTab("channels", "OWNER")).toBe("channels");
  });
});
