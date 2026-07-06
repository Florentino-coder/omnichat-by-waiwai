"use client";

import { KeyRound, MailPlus, Shield, Trash2, UserCog, Copy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Badge, Button, Card, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../../lib/api-client";
import { useLanguage } from "../../../lib/language-context";
import { getMessages } from "../../../lib/i18n";
import { canInviteOwner, canManageTeam } from "../../../lib/settings-rbac";
import { useAuthSession } from "../../../lib/use-auth-session";

type Role = "OWNER" | "ADMIN" | "AGENT" | "QC" | "VIEWER";

type Workspace = {
  id: string;
  name: string;
  isDefault?: boolean;
};

type WorkspaceMember = {
  id: string;
  userId: string;
  role: Role;
  isActive: boolean;
  user?: {
    email: string;
    displayName: string;
  };
};

type Invitation = {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  status: string;
  token?: string;
};

const roles: Role[] = ["OWNER", "ADMIN", "AGENT", "QC", "VIEWER"];

export default function TeamSettingsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("AGENT");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [resetPasswordMember, setResetPasswordMember] = useState<WorkspaceMember | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [removeTargetMember, setRemoveTargetMember] = useState<WorkspaceMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const { user, isLoading: isAuthLoading } = useAuthSession();
  const currentUserId = user?.id;
  const currentUserRole = user?.role as Role | undefined;
  const currentUserWorkspaceId = user?.workspaceId;
  const canInviteOwnerRole = canInviteOwner(currentUserRole);
  const canManageTeamAccess = canManageTeam(currentUserRole);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canManageTeamAccess) {
      router.replace("/app/settings");
    }
  }, [isAuthLoading, user, canManageTeamAccess, router]);

  useEffect(() => {
    if (isAuthLoading || !canManageTeamAccess) {
      return;
    }
    let active = true;
    async function loadInitial(): Promise<void> {
      setError(null);
      try {
        const workspaceList = await apiFetch<Workspace[]>("/api/v1/workspaces");
        if (!active) {
          return;
        }
        const safeWorkspaces = Array.isArray(workspaceList) ? workspaceList : [];
        const preferredWorkspaceId =
          currentUserWorkspaceId && safeWorkspaces.some((item) => item.id === currentUserWorkspaceId)
            ? currentUserWorkspaceId
            : safeWorkspaces[0]?.id ?? "";
        setWorkspaces(safeWorkspaces);
        setSelectedWorkspaceId(preferredWorkspaceId);
        if (preferredWorkspaceId) {
          await loadWorkspaceData(preferredWorkspaceId, active);
        }
      } catch (loadError) {
        if (active) {
          setError(readMessage(loadError, "Could not load team settings."));
        }
      }
    }

    void loadInitial();
    return () => {
      active = false;
    };
  }, [isAuthLoading, canManageTeamAccess, currentUserWorkspaceId]);

  if (isAuthLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading team settings...</p>
      </div>
    );
  }

  if (!canManageTeamAccess) {
    return null;
  }

  async function loadWorkspaceData(workspaceId: string, active = true): Promise<void> {
    const [membersResult, invitationsResult] = await Promise.all([
      apiFetch<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`),
      apiFetch<Invitation[]>("/api/v1/invitations")
    ]);

    if (!active) {
      return;
    }

    setMembers(Array.isArray(membersResult) ? membersResult : []);
    setInvitations(
      Array.isArray(invitationsResult)
        ? invitationsResult.filter((invitation) => invitation.workspaceId === workspaceId)
        : []
    );
  }

  async function loadInvitations(workspaceId: string): Promise<void> {
    const invitationsResult = await apiFetch<Invitation[]>("/api/v1/invitations");
    setInvitations(
      Array.isArray(invitationsResult)
        ? invitationsResult.filter((invitation) => invitation.workspaceId === workspaceId)
        : []
    );
  }

  async function handleWorkspaceChange(event: ChangeEvent<HTMLSelectElement>): Promise<void> {
    const workspaceId = event.target.value;
    setSelectedWorkspaceId(workspaceId);
    setError(null);
    await loadWorkspaceData(workspaceId);
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedWorkspaceId || !inviteEmail.trim()) {
      setError("Invite email is required.");
      return;
    }
    if (inviteRole === "OWNER" && !canInviteOwnerRole) {
      setError("Only owners can invite another owner.");
      return;
    }

    setIsSubmittingInvite(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ invitation: Invitation; inviteToken: string; inviteUrl: string }>(
        "/api/v1/invitations",
        {
          body: JSON.stringify({
            workspaceId: selectedWorkspaceId,
            email: inviteEmail.trim(),
            role: inviteRole
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );
      setInviteEmail("");
      setInviteRole("AGENT");
      setCreatedInviteUrl(result.inviteUrl);
      await loadInvitations(selectedWorkspaceId);
      setNotice(t.inviteLinkCreated);
    } catch (inviteError) {
      setError(readMessage(inviteError, "Could not create invitation link."));
    } finally {
      setIsSubmittingInvite(false);
    }
  }

  async function updateMemberRole(member: WorkspaceMember, role: Role): Promise<void> {
    if (!selectedWorkspaceId) {
      return;
    }
    setError(null);
    try {
      await apiFetch<WorkspaceMember>(
        `/api/v1/workspaces/${selectedWorkspaceId}/members/${member.userId}`,
        {
          body: JSON.stringify({ role }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
      await loadWorkspaceData(selectedWorkspaceId);
    } catch (updateError) {
      setError(readMessage(updateError, "Could not update member role."));
    }
  }

  async function confirmRemoveMember(): Promise<void> {
    const member = removeTargetMember;
    if (!member || !selectedWorkspaceId) {
      return;
    }
    setIsRemovingMember(true);
    setError(null);
    try {
      await apiFetch<WorkspaceMember>(
        `/api/v1/workspaces/${selectedWorkspaceId}/members/${member.userId}`,
        { method: "DELETE" }
      );
      setRemoveTargetMember(null);
      setNotice(
        locale === "th"
          ? `ลบ ${member.user?.displayName ?? member.userId} แล้ว`
          : `Removed ${member.user?.displayName ?? member.userId}`
      );
      await loadWorkspaceData(selectedWorkspaceId);
    } catch (removeError) {
      setError(readMessage(removeError, "Could not remove member."));
    } finally {
      setIsRemovingMember(false);
    }
  }

  async function submitResetPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const member = resetPasswordMember;
    if (!member || !selectedWorkspaceId || resetPasswordValue.length < 8) {
      return;
    }
    setIsResettingPassword(true);
    setError(null);
    try {
      await apiFetch<void>(
        `/api/v1/workspaces/${selectedWorkspaceId}/members/${member.userId}/reset-password`,
        {
          body: JSON.stringify({ newPassword: resetPasswordValue }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );
      setResetPasswordMember(null);
      setResetPasswordValue("");
      setNotice(
        locale === "th"
          ? `รีเซ็ตรหัสผ่านของ ${member.user?.displayName ?? member.userId} แล้ว`
          : `Reset password for ${member.user?.displayName ?? member.userId}`
      );
    } catch (resetError) {
      setError(readMessage(resetError, "Could not reset password."));
    } finally {
      setIsResettingPassword(false);
    }
  }

  async function removeMember(member: WorkspaceMember): Promise<void> {
    setRemoveTargetMember(member);
  }

  async function revokeInvitation(invitation: Invitation): Promise<void> {
    setError(null);
    try {
      await apiFetch<Invitation>(`/api/v1/invitations/${invitation.id}`, {
        method: "DELETE"
      });
      await loadWorkspaceData(selectedWorkspaceId);
    } catch (revokeError) {
      setError(readMessage(revokeError, "Could not revoke invitation."));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <section aria-labelledby="team-heading" className="max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 id="team-heading" className="font-heading text-2xl font-medium text-foreground">
              {t.teamTitle}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.teamSubtitle}
            </p>
          </div>
          <label className="grid min-w-56 gap-1 text-xs font-medium text-muted-foreground">
            {t.workspaceLabel}
            <select
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground"
              onChange={(event) => void handleWorkspaceChange(event)}
              value={selectedWorkspaceId}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="p-5 h-fit">
            <div className="mb-4 flex items-center gap-2">
              <UserCog size={18} aria-hidden="true" className="text-indigo-600" />
              <h2 className="font-heading text-base font-medium text-foreground">{t.members}</h2>
            </div>
            <div className="divide-y divide-border">
              {members.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">{t.noActiveMembers}</p>
              ) : null}
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                return (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.user?.displayName ?? member.userId}
                      {isSelf ? (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.user?.email ?? member.userId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Role for ${member.user?.email ?? member.userId}`}
                      className="h-8 rounded-md border border-border bg-white px-2 text-xs"
                      disabled={isSelf}
                      onChange={(event) => void updateMemberRole(member, event.target.value as Role)}
                      value={member.role}
                    >
                      {roles.map((role) => (
                        <option key={role} disabled={role === "OWNER" && !canInviteOwnerRole} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <Button
                      aria-label={`Reset password for ${member.user?.email ?? member.userId}`}
                      disabled={isSelf}
                      onClick={() => {
                        setResetPasswordMember(member);
                        setResetPasswordValue("");
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <KeyRound size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`Remove ${member.user?.email ?? member.userId}`}
                      disabled={isSelf}
                      onClick={() => void removeMember(member)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
              })}
            </div>
          </Card>

          <Card className="p-5 border border-indigo-500/10 shadow-sm bg-white h-fit">
            <div className="mb-4 flex items-center gap-2">
              <MailPlus size={18} aria-hidden="true" className="text-indigo-600" />
              <h2 className="font-heading text-base font-medium text-foreground">{t.invite}</h2>
            </div>
            <form className="grid gap-3" onSubmit={(event) => void sendInvite(event)}>
              <div className="grid gap-2">
                <Label htmlFor="invite-email">{t.inviteEmail}</Label>
                <Input
                  id="invite-email"
                  onChange={(event) => setInviteEmail(event.target.value)}
                  type="email"
                  value={inviteEmail}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-role">{t.inviteRole}</Label>
                <select
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground"
                  id="invite-role"
                  onChange={(event) => setInviteRole(event.target.value as Role)}
                  value={inviteRole}
                >
                  {roles.map((role) => (
                    <option key={role} disabled={role === "OWNER" && !canInviteOwnerRole} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <Button disabled={isSubmittingInvite || !selectedWorkspaceId} type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20">
                {t.createInviteLink}
              </Button>
            </form>

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Shield size={16} aria-hidden="true" className="text-indigo-600" />
                <h3 className="text-sm font-medium text-foreground">{t.pendingInvitations}</h3>
              </div>
              <div className="grid gap-2">
                {invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noPendingInvitations}</p>
                ) : null}
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invitation.email}</p>
                      <div className="mt-1 flex gap-1.5 flex-wrap">
                        <Badge variant="muted">{invitation.role}</Badge>
                        <Badge variant={getStatusBadgeVariant(invitation.status)}>{invitation.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {invitation.token ? (
                        <Button
                          aria-label={`Copy invitation link for ${invitation.email}`}
                          onClick={() => {
                            const inviteUrl = `${window.location.origin}/invite/accept?token=${invitation.token}`;
                            void navigator.clipboard.writeText(inviteUrl);
                            setNotice(`Copied invitation link for ${invitation.email}`);
                            setTimeout(() => setNotice(null), 3000);
                          }}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <Copy size={14} aria-hidden="true" />
                        </Button>
                      ) : null}
                      <Button
                        aria-label={`Revoke invite ${invitation.email}`}
                        onClick={() => void revokeInvitation(invitation)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {createdInviteUrl ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-labelledby="invite-link-title"
          >
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 id="invite-link-title" className="font-heading text-base font-medium">
                  {t.inviteLinkCreated}
                </h2>
                <Button
                  aria-label={t.closeModal}
                  onClick={() => setCreatedInviteUrl(null)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <X size={14} aria-hidden="true" />
                </Button>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                {locale === "th"
                  ? "แชร์ลิงก์นี้กับสมาชิกใหม่เพื่อให้เข้าร่วม workspace"
                  : "Share this link with the invitee to join the workspace."}
              </p>
              <div className="flex gap-2">
                <Input readOnly value={createdInviteUrl} aria-label="Invite link" />
                <Button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdInviteUrl);
                    setNotice(t.copiedLink);
                  }}
                >
                  <Copy size={14} aria-hidden="true" className="mr-1" />
                  {t.copyInviteLink}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {resetPasswordMember ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-labelledby="reset-password-title"
          >
            <form
              className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg"
              onSubmit={(event) => void submitResetPassword(event)}
            >
              <h2 id="reset-password-title" className="font-heading text-base font-medium">
                {t.resetPasswordFor} {resetPasswordMember.user?.displayName ?? resetPasswordMember.userId}
              </h2>
              <div className="mt-4 grid gap-2">
                <Label htmlFor="admin-new-password">{t.newPassword}</Label>
                <Input
                  id="admin-new-password"
                  minLength={8}
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                  required
                  type="password"
                  value={resetPasswordValue}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  onClick={() => setResetPasswordMember(null)}
                  type="button"
                  variant="secondary"
                >
                  {t.cancelEdit}
                </Button>
                <Button disabled={isResettingPassword || resetPasswordValue.length < 8} type="submit">
                  {t.resetPassword}
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {removeTargetMember ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="alertdialog"
            aria-labelledby="remove-member-title"
          >
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
              <h2 id="remove-member-title" className="font-heading text-base font-medium">
                {t.confirmRemoveMember}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.confirmRemoveMemberBody}</p>
              <p className="mt-1 text-sm font-medium">
                {removeTargetMember.user?.displayName ?? removeTargetMember.userId}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => setRemoveTargetMember(null)} type="button" variant="secondary">
                  {t.cancelEdit}
                </Button>
                <Button
                  disabled={isRemovingMember}
                  onClick={() => void confirmRemoveMember()}
                  type="button"
                >
                  {t.confirmRemoveMember}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function getStatusBadgeVariant(status: string): "success" | "warning" | "danger" | "muted" {
  switch (status.toUpperCase()) {
    case "ACCEPTED":
      return "success";
    case "PENDING":
      return "warning";
    case "REVOKED":
    case "EXPIRED":
      return "danger";
    default:
      return "muted";
  }
}

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
