"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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
  lineChannelId: string;
  workspaceId: string;
  createdAt: string;
};

type FormState = {
  workspaceId: string;
  name: string;
  lineChannelId: string;
  channelSecret: string;
  channelAccessToken: string;
};

const initialForm: FormState = {
  workspaceId: "",
  name: "",
  lineChannelId: "",
  channelSecret: "",
  channelAccessToken: ""
};

export function LineChannelForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        workspaceId: current.workspaceId
      }));
    } catch {
      setError("Could not save LINE channel. Check values and role permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 grid gap-5">
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
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium">{channel.name}</p>
                <p className="text-xs text-muted-foreground">{channel.lineChannelId}</p>
              </div>
              <Badge variant="muted">
                {workspaces.find((workspace) => workspace.id === channel.workspaceId)?.name ??
                  "Workspace"}
              </Badge>
            </div>
          ))}
        </div>
      </div>

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
            placeholder="Main LINE OA"
            autoComplete="off"
          />
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
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={!isComplete || isSaving} className="w-fit">
          {isSaving ? "Saving..." : "Save LINE channel"}
        </Button>
      </form>
    </div>
  );
}

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
