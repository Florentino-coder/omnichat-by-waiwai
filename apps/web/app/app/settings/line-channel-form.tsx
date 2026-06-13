"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, Copy, Pencil, Trash2, X } from "lucide-react";
import { Badge, Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";

type Workspace = {
  id: string;
  name: string;
  isDefault?: boolean;
};

type LineChannel = {
  id: string;
  name: string;
  badgeColor?: string | null;
  lineChannelId: string;
  workspaceId: string;
  createdAt: string;
};

type FormState = {
  workspaceId: string;
  name: string;
  badgeColor: string;
  lineChannelId: string;
  channelSecret: string;
  channelAccessToken: string;
};

const initialForm: FormState = {
  workspaceId: "",
  name: "",
  badgeColor: "#4f46e5",
  lineChannelId: "",
  channelSecret: "",
  channelAccessToken: ""
};

type EditState = {
  channelId: string;
  name: string;
  badgeColor: string;
};

export function LineChannelForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy toast
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isComplete = Object.values(form).every((value) => value.trim().length > 0);
  const selectedWorkspaceName = useMemo(
    () => workspaces.find((workspace) => workspace.id === form.workspaceId)?.name ?? null,
    [form.workspaceId, workspaces]
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadSettingsData(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const [workspaceData, channelData] = await Promise.all([
          apiFetch<Workspace[]>("/api/v1/workspaces"),
          apiFetch<LineChannel[]>("/api/v1/line/channels")
        ]);
        if (!isCurrent) {
          return;
        }
        const defaultWorkspace =
          workspaceData.find((workspace) => workspace.isDefault) ?? workspaceData[0];
        setWorkspaces(workspaceData);
        setChannels(channelData);
        setForm((current) => ({
          ...current,
          name: current.name || nextLineChannelName(channelData),
          workspaceId: current.workspaceId || defaultWorkspace?.id || ""
        }));
      } catch (loadError) {
        if (isCurrent) {
          setError(readMessage(loadError, "Could not load settings data."));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadSettingsData();

    return () => {
      isCurrent = false;
    };
  }, []);

  const updateField =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setMessage(null);
      setError(null);
    };

  const saveChannel = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!isComplete || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      await apiFetch<LineChannel>("/api/v1/line/channels", {
        body: JSON.stringify({
          channelAccessToken: form.channelAccessToken.trim(),
          channelSecret: form.channelSecret.trim(),
          badgeColor: form.badgeColor.trim(),
          lineChannelId: form.lineChannelId.trim(),
          name: form.name.trim(),
          workspaceId: form.workspaceId.trim()
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const channelData = await apiFetch<LineChannel[]>("/api/v1/line/channels");
      setChannels(channelData);
      setMessage("LINE channel saved. Webhook ready for production test.");
      setForm((current) => ({
        ...initialForm,
        name: nextLineChannelName(channelData),
        workspaceId: current.workspaceId
      }));
    } catch {
      setError("Could not save LINE channel. Check values and role permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit handlers ────────────────────────────────────────────────────────

  function startEdit(channel: LineChannel) {
    setEditState({
      channelId: channel.id,
      name: channel.name,
      badgeColor: channel.badgeColor ?? "#4f46e5"
    });
    setUpdateError(null);
  }

  function cancelEdit() {
    setEditState(null);
    setUpdateError(null);
  }

  async function submitEdit(): Promise<void> {
    if (!editState || isUpdating) return;

    setIsUpdating(true);
    setUpdateError(null);
    try {
      const updated = await apiFetch<LineChannel>(`/api/v1/line/channels/${editState.channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editState.name, badgeColor: editState.badgeColor })
      });
      setChannels((current) =>
        current.map((c) => (c.id === updated.id ? { ...c, name: updated.name, badgeColor: updated.badgeColor } : c))
      );
      setEditState(null);
    } catch {
      setUpdateError("อัปเดตไม่สำเร็จ ลองใหม่");
    } finally {
      setIsUpdating(false);
    }
  }

  // ── Delete handlers ──────────────────────────────────────────────────────

  async function confirmDelete(channelId: string): Promise<void> {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await apiFetch<null>(`/api/v1/line/channels/${channelId}`, { method: "DELETE" });
      setChannels((current) => current.filter((c) => c.id !== channelId));
      setDeleteConfirmId(null);
    } catch {
      setError("ลบ channel ไม่สำเร็จ");
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Copy webhook URL ─────────────────────────────────────────────────────

  async function copyWebhookUrl(lineChannelId: string, channelDbId: string): Promise<void> {
    const url = getWebhookUrl(lineChannelId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(channelDbId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="mt-4 grid gap-5">
      {/* Connected channels list */}
      <div className="rounded-md border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-sm font-medium">Connected LINE channels</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Webhook path: /api/v1/line/webhook/&lt;LINE channel ID&gt;
            </p>
          </div>
          <Badge variant={channels.length > 0 ? "success" : "muted"}>
            {channels.length} connected
          </Badge>
        </div>
        <div className="mt-3 divide-y divide-border">
          {isLoading ? <p className="py-2 text-sm text-muted-foreground">Loading...</p> : null}
          {!isLoading && channels.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No LINE channel connected yet.</p>
          ) : null}
          {channels.map((channel) => {
            const isEditing = editState?.channelId === channel.id;
            const isDeleteConfirm = deleteConfirmId === channel.id;
            const isCopied = copiedId === channel.id;

            return (
              <div key={channel.id} className="py-3">
                {isEditing ? (
                  /* ── Inline edit form ── */
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`edit-name-${channel.id}`} className="text-xs">
                        Channel name
                      </Label>
                      <Input
                        id={`edit-name-${channel.id}`}
                        value={editState.name}
                        onChange={(e) =>
                          setEditState((s) => s ? { ...s, name: e.target.value } : s)
                        }
                        autoFocus
                        maxLength={120}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`edit-color-${channel.id}`} className="text-xs">
                        Badge color
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id={`edit-color-${channel.id}`}
                          type="color"
                          value={editState.badgeColor}
                          onChange={(e) =>
                            setEditState((s) => s ? { ...s, badgeColor: e.target.value } : s)
                          }
                          className="h-9 w-16 p-1"
                        />
                        <span
                          className="inline-flex min-w-20 items-center justify-center rounded-md border px-3 py-1 text-xs font-medium text-white"
                          style={{ backgroundColor: editState.badgeColor, borderColor: editState.badgeColor }}
                        >
                          {editState.name || channel.name}
                        </span>
                      </div>
                    </div>
                    {updateError ? <p className="text-xs text-danger">{updateError}</p> : null}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitEdit} disabled={isUpdating}>
                        <Check size={13} aria-hidden="true" />
                        {isUpdating ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={isUpdating}>
                        <X size={13} aria-hidden="true" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : isDeleteConfirm ? (
                  /* ── Delete confirm ── */
                  <div className="flex items-center gap-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
                    <p className="flex-1 text-sm text-danger">
                      ลบ <strong>{channel.name}</strong>? ไม่สามารถย้อนกลับได้
                    </p>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => confirmDelete(channel.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "ยืนยันลบ"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={isDeleting}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                ) : (
                  /* ── Normal row ── */
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: channel.badgeColor ?? "#4f46e5" }}
                        />
                        <p className="text-sm font-medium">{channel.name}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{channel.lineChannelId}</p>
                      {/* Webhook URL row with copy button */}
                      <div className="mt-1 flex items-center gap-1.5">
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          {getWebhookUrl(channel.lineChannelId)}
                        </p>
                        <button
                          type="button"
                          title={isCopied ? "Copied!" : "Copy webhook URL"}
                          aria-label="Copy webhook URL"
                          onClick={() => copyWebhookUrl(channel.lineChannelId, channel.id)}
                          className={[
                            "shrink-0 rounded p-1 transition-colors",
                            isCopied
                              ? "bg-success/10 text-success"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          ].join(" ")}
                        >
                          {isCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    {/* Right: workspace badge + action buttons */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant="muted">
                        {workspaces.find((w) => w.id === channel.workspaceId)?.name ?? "Workspace"}
                      </Badge>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="แก้ไข"
                          aria-label="แก้ไข channel"
                          onClick={() => startEdit(channel)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="ลบ"
                          aria-label="ลบ channel"
                          onClick={() => setDeleteConfirmId(channel.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>

      {/* Add channel form */}
      <form onSubmit={saveChannel} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="workspaceId">Workspace</Label>
          <select
            id="workspaceId"
            name="workspaceId"
            value={form.workspaceId}
            onChange={updateField("workspaceId")}
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
            disabled={isLoading || workspaces.length === 0}
          >
            <option value="">Select workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          {selectedWorkspaceName ? (
            <p className="text-xs text-muted-foreground">Selected: {selectedWorkspaceName}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Channel name</Label>
          <Input
            id="name"
            name="name"
            value={form.name}
            onChange={updateField("name")}
            placeholder={nextLineChannelName(channels)}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="badgeColor">Badge color</Label>
          <div className="flex items-center gap-3">
            <Input
              id="badgeColor"
              name="badgeColor"
              value={form.badgeColor}
              onChange={updateField("badgeColor")}
              type="color"
              className="h-10 w-16 p-1"
            />
            <span
              className="inline-flex min-w-24 items-center justify-center rounded-md border px-3 py-2 text-xs font-medium text-white"
              style={{
                backgroundColor: form.badgeColor,
                borderColor: form.badgeColor
              }}
            >
              {form.name || nextLineChannelName(channels)}
            </span>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lineChannelId">LINE channel ID</Label>
          <Input
            id="lineChannelId"
            name="lineChannelId"
            value={form.lineChannelId}
            onChange={updateField("lineChannelId")}
            placeholder="LINE channel ID"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="channelSecret">Channel secret</Label>
          <Input
            id="channelSecret"
            name="channelSecret"
            value={form.channelSecret}
            onChange={updateField("channelSecret")}
            placeholder="LINE channel secret"
            autoComplete="off"
            type="password"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="channelAccessToken">Channel access token</Label>
          <Input
            id="channelAccessToken"
            name="channelAccessToken"
            value={form.channelAccessToken}
            onChange={updateField("channelAccessToken")}
            placeholder="Long-lived channel access token"
            autoComplete="off"
            type="password"
          />
        </div>
        {message ? <p className="text-sm text-success">{message}</p> : null}
        <Button type="submit" disabled={!isComplete || isSaving} className="w-fit">
          {isSaving ? "Saving..." : "Add LINE OA channel"}
        </Button>
      </form>
    </div>
  );
}

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getWebhookUrl(lineChannelId: string): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  const baseUrl = apiBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${baseUrl}/api/v1/line/webhook/${lineChannelId}`;
}

function nextLineChannelName(channels: LineChannel[]): string {
  return `Line OA ${channels.length + 1}`;
}
