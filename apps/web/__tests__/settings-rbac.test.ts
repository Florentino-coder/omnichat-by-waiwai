import {
  canAccessSettingsTab,
  canDeleteKnowledge,
  canInviteOwner,
  canManageAutomation,
  canManageKnowledge,
  canManageScenarios,
  canManageSharedQuickReplies,
  canManageTeam,
  defaultSettingsTab,
  isOwnerOrAdmin,
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

  it("identifies owner and admin roles", () => {
    expect(isOwnerOrAdmin("OWNER")).toBe(true);
    expect(isOwnerOrAdmin("ADMIN")).toBe(true);
    expect(isOwnerOrAdmin("AGENT")).toBe(false);
    expect(isOwnerOrAdmin(null)).toBe(false);
  });

  it("allows owners and admins to manage shared quick replies", () => {
    expect(canManageSharedQuickReplies("OWNER")).toBe(true);
    expect(canManageSharedQuickReplies("ADMIN")).toBe(true);
    expect(canManageSharedQuickReplies("AGENT")).toBe(false);
    expect(canManageSharedQuickReplies(null)).toBe(false);
  });

  it("allows owners and admins to manage automation", () => {
    expect(canManageAutomation("OWNER")).toBe(true);
    expect(canManageAutomation("ADMIN")).toBe(true);
    expect(canManageAutomation("AGENT")).toBe(false);
  });

  it("allows owners, admins, and agents to manage knowledge", () => {
    expect(canManageKnowledge("OWNER")).toBe(true);
    expect(canManageKnowledge("ADMIN")).toBe(true);
    expect(canManageKnowledge("AGENT")).toBe(true);
    expect(canManageKnowledge("QC")).toBe(false);
    expect(canManageKnowledge("VIEWER")).toBe(false);
  });

  it("allows only owners and admins to delete knowledge", () => {
    expect(canDeleteKnowledge("OWNER")).toBe(true);
    expect(canDeleteKnowledge("ADMIN")).toBe(true);
    expect(canDeleteKnowledge("AGENT")).toBe(false);
  });

  it("allows owners and admins to manage team", () => {
    expect(canManageTeam("OWNER")).toBe(true);
    expect(canManageTeam("ADMIN")).toBe(true);
    expect(canManageTeam("AGENT")).toBe(false);
  });

  it("allows only owners to invite other owners", () => {
    expect(canInviteOwner("OWNER")).toBe(true);
    expect(canInviteOwner("ADMIN")).toBe(false);
    expect(canInviteOwner("AGENT")).toBe(false);
  });

  it("allows owners and admins to manage scenarios", () => {
    expect(canManageScenarios("OWNER")).toBe(true);
    expect(canManageScenarios("ADMIN")).toBe(true);
    expect(canManageScenarios("AGENT")).toBe(false);
    expect(canManageScenarios(null)).toBe(false);
  });
});
