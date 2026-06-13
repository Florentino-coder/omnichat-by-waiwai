"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input, Label } from "@omnichat/ui";

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
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isComplete = Object.values(form).every((value) => value.trim().length > 0);

  const updateField =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
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

    const response = await fetch("/api/v1/line/channels", {
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

    setIsSaving(false);

    if (!response.ok) {
      setError("Could not save LINE channel. Check values and role permissions.");
      return;
    }

    setMessage("LINE channel saved. Webhook ready for production test.");
    setForm(initialForm);
  };

  return (
    <form onSubmit={saveChannel} className="mt-4 grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="workspaceId">Workspace ID</Label>
        <Input
          id="workspaceId"
          name="workspaceId"
          value={form.workspaceId}
          onChange={updateField("workspaceId")}
          placeholder="workspace uuid"
          autoComplete="off"
        />
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
  );
}
