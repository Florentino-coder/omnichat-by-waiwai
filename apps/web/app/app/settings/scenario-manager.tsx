"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { GitBranch, Pencil, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";

type LineChannel = {
  id: string;
  name: string;
};

type WorkspaceMember = {
  id: string;
  userId: string;
  role: string;
  user: {
    displayName: string;
    email: string;
  };
};

type AiScenario = {
  id: string;
  lineChannelId?: string | null;
  name: string;
  priority: number;
  isEnabled: boolean;
  triggerKeywords: string[];
  triggerTagNames: string[];
  activeHourStart?: number | null;
  activeHourEnd?: number | null;
  instructions: string;
  actionAddTagName?: string | null;
  actionAssignMemberId?: string | null;
  actionSetPriority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | null;
  actionEscalate: boolean;
};

type FormState = {
  name: string;
  priority: string;
  isEnabled: boolean;
  triggerKeywords: string;
  triggerTagNames: string;
  activeHourStart: string;
  activeHourEnd: string;
  instructions: string;
  lineChannelId: string;
  actionAddTagName: string;
  actionAssignMemberId: string;
  actionSetPriority: string;
  actionEscalate: boolean;
};

const emptyForm: FormState = {
  name: "",
  priority: "100",
  isEnabled: true,
  triggerKeywords: "",
  triggerTagNames: "",
  activeHourStart: "",
  activeHourEnd: "",
  instructions: "",
  lineChannelId: "",
  actionAddTagName: "",
  actionAssignMemberId: "",
  actionSetPriority: "",
  actionEscalate: false
};

function readMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toForm(scenario: AiScenario): FormState {
  return {
    name: scenario.name,
    priority: String(scenario.priority),
    isEnabled: scenario.isEnabled,
    triggerKeywords: scenario.triggerKeywords.join(", "),
    triggerTagNames: scenario.triggerTagNames.join(", "),
    activeHourStart:
      scenario.activeHourStart === null || scenario.activeHourStart === undefined
        ? ""
        : String(scenario.activeHourStart),
    activeHourEnd:
      scenario.activeHourEnd === null || scenario.activeHourEnd === undefined
        ? ""
        : String(scenario.activeHourEnd),
    instructions: scenario.instructions,
    lineChannelId: scenario.lineChannelId ?? "",
    actionAddTagName: scenario.actionAddTagName ?? "",
    actionAssignMemberId: scenario.actionAssignMemberId ?? "",
    actionSetPriority: scenario.actionSetPriority ?? "",
    actionEscalate: scenario.actionEscalate
  };
}

export function ScenarioManager() {
  const [role, setRole] = useState<string>("AGENT");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("all");
  const [scenarios, setScenarios] = useState<AiScenario[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = role === "OWNER" || role === "ADMIN";
  const canDelete = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("omnichat.user");
      if (stored) {
        const parsed = JSON.parse(stored) as { role?: string; workspaceId?: string };
        setRole(parsed.role ?? "AGENT");
        setWorkspaceId(parsed.workspaceId ?? null);
      }
    } catch {
      setRole("AGENT");
    }
  }, []);

  useEffect(() => {
    async function loadChannels() {
      try {
        const data = await apiFetch<LineChannel[]>("/api/v1/line/channels");
        setChannels(Array.isArray(data) ? data : []);
      } catch {
        setChannels([]);
      }
    }
    void loadChannels();
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }

    async function loadMembers() {
      try {
        const data = await apiFetch<WorkspaceMember[]>(
          `/api/v1/workspaces/${workspaceId}/members`
        );
        setMembers(Array.isArray(data) ? data : []);
      } catch {
        setMembers([]);
      }
    }
    void loadMembers();
  }, [workspaceId]);

  async function loadScenarios(channelFilter: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (channelFilter !== "all") {
        params.set("lineChannelId", channelFilter);
      }
      const query = params.toString();
      const path = query ? `/api/v1/ai/scenarios?${query}` : "/api/v1/ai/scenarios";
      const data = await apiFetch<AiScenario[]>(path);
      setScenarios(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(readMessage(loadError, "Failed to load AI scenarios"));
      setScenarios([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadScenarios(selectedChannelId);
  }, [selectedChannelId]);

  const sortedScenarios = useMemo(
    () => [...scenarios].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    [scenarios]
  );

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleEdit(scenario: AiScenario) {
    setEditingId(scenario.id);
    setForm(toForm(scenario));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      priority: Number(form.priority) || 100,
      isEnabled: form.isEnabled,
      triggerKeywords: parseCommaList(form.triggerKeywords),
      triggerTagNames: parseCommaList(form.triggerTagNames),
      activeHourStart: form.activeHourStart === "" ? undefined : Number(form.activeHourStart),
      activeHourEnd: form.activeHourEnd === "" ? undefined : Number(form.activeHourEnd),
      instructions: form.instructions.trim(),
      lineChannelId: form.lineChannelId || undefined,
      actionAddTagName: form.actionAddTagName.trim() || undefined,
      actionAssignMemberId: form.actionAssignMemberId || undefined,
      actionSetPriority: form.actionSetPriority || undefined,
      actionEscalate: form.actionEscalate
    };

    try {
      if (editingId) {
        await apiFetch(`/api/v1/ai/scenarios/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/api/v1/ai/scenarios", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetForm();
      await loadScenarios(selectedChannelId);
    } catch (saveError) {
      setError(readMessage(saveError, "Failed to save AI scenario"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canDelete) {
      return;
    }
    if (!window.confirm("Delete this scenario?")) {
      return;
    }

    setError(null);
    try {
      await apiFetch(`/api/v1/ai/scenarios/${id}`, { method: "DELETE" });
      if (editingId === id) {
        resetForm();
      }
      await loadScenarios(selectedChannelId);
    } catch (deleteError) {
      setError(readMessage(deleteError, "Failed to delete AI scenario"));
    }
  }

  function updateFormField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const target = event.target;
    const value =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
    setForm((current) => ({ ...current, [target.name]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#ECEBFF] bg-[#F8F7FF] p-4 text-sm text-[#4636D7]">
        <div className="flex items-start gap-2">
          <GitBranch size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Scenario Engine (Zaapi-style rules)</p>
            <p className="text-[#5B54A8]">
              Match customer messages by keywords/tags → inject instructions into AI prompt → optional auto-tag, assign, or escalate.
            </p>
            <p className="text-[#5B54A8]">
              Lower priority number wins first. Use placeholder{" "}
              <code className="rounded border border-[#DEDDE6] bg-white px-1 font-mono text-xs">
                {"{{scenario_instructions}}"}
              </code>{" "}
              in AI prompt template.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="scenario-channel-filter" className="text-sm font-medium text-[#16182B]">
          Channel scope
        </Label>
        <select
          id="scenario-channel-filter"
          value={selectedChannelId}
          onChange={(event) => setSelectedChannelId(event.target.value)}
          className="rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm"
        >
          <option value="all">All channels</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>

      {canEdit ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#DEDDE6] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#16182B]">
              {editingId ? "Edit scenario" : "New scenario"}
            </h3>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                <X size={14} className="mr-1" />
                Cancel
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={form.name} onChange={updateFormField} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (lower = first)</Label>
              <Input
                id="priority"
                name="priority"
                type="number"
                min={1}
                max={9999}
                value={form.priority}
                onChange={updateFormField}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="triggerKeywords">Trigger keywords (comma-separated)</Label>
              <Input
                id="triggerKeywords"
                name="triggerKeywords"
                value={form.triggerKeywords}
                onChange={updateFormField}
                placeholder="ราคา, price, ส่งของ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="triggerTagNames">Trigger tags (comma-separated)</Label>
              <Input
                id="triggerTagNames"
                name="triggerTagNames"
                value={form.triggerTagNames}
                onChange={updateFormField}
                placeholder="VIP, สนใจซื้อ"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lineChannelId">LINE channel (optional)</Label>
              <select
                id="lineChannelId"
                name="lineChannelId"
                value={form.lineChannelId}
                onChange={updateFormField}
                className="w-full rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm"
              >
                <option value="">All channels</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activeHourStart">Active from hour (0-23)</Label>
              <Input
                id="activeHourStart"
                name="activeHourStart"
                type="number"
                min={0}
                max={23}
                value={form.activeHourStart}
                onChange={updateFormField}
                placeholder="9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activeHourEnd">Active until hour (0-23)</Label>
              <Input
                id="activeHourEnd"
                name="activeHourEnd"
                type="number"
                min={0}
                max={23}
                value={form.activeHourEnd}
                onChange={updateFormField}
                placeholder="18"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">AI instructions when matched</Label>
            <textarea
              id="instructions"
              name="instructions"
              value={form.instructions}
              onChange={updateFormField}
              required
              rows={4}
              className="w-full rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm"
              placeholder="ถามเรื่องราคา → แจ้งช่วงราคา + ขอเบอร์ติดต่อ"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="actionAddTagName">Auto-add tag (optional)</Label>
              <Input
                id="actionAddTagName"
                name="actionAddTagName"
                value={form.actionAddTagName}
                onChange={updateFormField}
                placeholder="สนใจราคา"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actionAssignMemberId">Auto-assign member (optional)</Label>
              <select
                id="actionAssignMemberId"
                name="actionAssignMemberId"
                value={form.actionAssignMemberId}
                onChange={updateFormField}
                className="w-full rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm"
              >
                <option value="">No auto-assign</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user.displayName || member.user.email} ({member.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="actionSetPriority">Set priority (optional)</Label>
              <select
                id="actionSetPriority"
                name="actionSetPriority"
                value={form.actionSetPriority}
                onChange={updateFormField}
                className="w-full rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm"
              >
                <option value="">No change</option>
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm text-[#16182B]">
              <input
                type="checkbox"
                name="actionEscalate"
                checked={form.actionEscalate}
                onChange={updateFormField}
              />
              Escalate to HIGH priority if no priority set
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#16182B]">
            <input
              type="checkbox"
              name="isEnabled"
              checked={form.isEnabled}
              onChange={updateFormField}
            />
            Enabled
          </label>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : editingId ? "Update scenario" : "Create scenario"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-[#767A8C]">Only Owner/Admin can create or edit scenarios.</p>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-[#16182B]">Scenarios ({sortedScenarios.length})</h3>
        {isLoading ? (
          <p className="text-sm text-[#767A8C]">Loading...</p>
        ) : sortedScenarios.length === 0 ? (
          <p className="text-sm text-[#767A8C]">No scenarios yet.</p>
        ) : (
          sortedScenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="rounded-xl border border-[#DEDDE6] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-[#16182B]">{scenario.name}</h4>
                    <span className="rounded-full bg-[#ECEBFF] px-2 py-0.5 text-xs font-medium text-[#4636D7]">
                      priority {scenario.priority}
                    </span>
                    {!scenario.isEnabled ? (
                      <span className="rounded-full bg-[#F6F5FA] px-2 py-0.5 text-xs text-[#767A8C]">
                        disabled
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#767A8C] line-clamp-2">{scenario.instructions}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-[#767A8C]">
                    {scenario.triggerKeywords.length > 0 ? (
                      <span>keywords: {scenario.triggerKeywords.join(", ")}</span>
                    ) : null}
                    {scenario.triggerTagNames.length > 0 ? (
                      <span>tags: {scenario.triggerTagNames.join(", ")}</span>
                    ) : null}
                    {scenario.actionAddTagName ? (
                      <span>+tag {scenario.actionAddTagName}</span>
                    ) : null}
                  </div>
                </div>
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => handleEdit(scenario)}>
                      <Pencil size={14} />
                    </Button>
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDelete(scenario.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
