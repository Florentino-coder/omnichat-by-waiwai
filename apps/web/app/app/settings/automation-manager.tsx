"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Workflow, Pencil, Trash2, Plus, X } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";
import {
  getAutomationStepOptions,
  getAutomationTriggerOptions,
  getMessages
} from "../../lib/i18n";
import { canManageAutomation } from "../../lib/settings-rbac";
import { useAuthSession } from "../../lib/use-auth-session";

type LineChannel = { id: string; name: string };

type WorkspaceMember = {
  id: string;
  user: { displayName: string; email: string };
};

type SavedReply = {
  id: string;
  title: string;
};

type AutomationTriggerType =
  | "MESSAGE_RECEIVED"
  | "CONVERSATION_CREATED"
  | "TAG_ADDED"
  | "STATUS_CHANGED"
  | "OFF_HOURS";

type StepType =
  | "ADD_TAG"
  | "ASSIGN_AGENT"
  | "SET_PRIORITY"
  | "SEND_TEXT_REPLY"
  | "SEND_IMAGE_REPLY"
  | "SEND_SAVED_REPLY"
  | "WAIT"
  | "CLOSE_CONVERSATION"
  | "ESCALATE";

type StepDraft = {
  id: string;
  type: StepType;
  tagName: string;
  memberId: string;
  priority: string;
  text: string;
  imageUrl: string;
  savedReplyId: string;
  delaySeconds: string;
  waitForCustomerReply: boolean;
};

type AutomationRule = {
  id: string;
  lineChannelId?: string | null;
  name: string;
  priority: number;
  isEnabled: boolean;
  triggerType: AutomationTriggerType;
  triggerKeywords: string[];
  triggerTagNames: string[];
  triggerStatus?: string | null;
  offHourStart?: number | null;
  offHourEnd?: number | null;
  steps: unknown[];
};

type FormState = {
  name: string;
  priority: string;
  isEnabled: boolean;
  triggerType: AutomationTriggerType;
  triggerKeywords: string;
  triggerTagNames: string;
  triggerStatus: string;
  offHourStart: string;
  offHourEnd: string;
  lineChannelId: string;
  steps: StepDraft[];
};

const emptyStep = (): StepDraft => ({
  id: crypto.randomUUID(),
  type: "SEND_TEXT_REPLY",
  tagName: "",
  memberId: "",
  priority: "NORMAL",
  text: "",
  imageUrl: "",
  savedReplyId: "",
  delaySeconds: "60",
  waitForCustomerReply: false
});

const emptyForm: FormState = {
  name: "",
  priority: "100",
  isEnabled: true,
  triggerType: "OFF_HOURS",
  triggerKeywords: "",
  triggerTagNames: "",
  triggerStatus: "RESOLVED",
  offHourStart: "9",
  offHourEnd: "18",
  lineChannelId: "",
  steps: [emptyStep()]
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

function ruleHasReplyDrivenSteps(steps: unknown[]): boolean {
  if (!Array.isArray(steps)) {
    return false;
  }
  return steps.some((raw, index) => {
    if (index === 0 || !raw || typeof raw !== "object") {
      return false;
    }
    return (raw as Record<string, unknown>).runAfter === "customer_reply";
  });
}

function appendRunAfter(
  payload: Record<string, unknown>,
  index: number,
  waitForCustomerReply: boolean
): Record<string, unknown> {
  if (index > 0 && waitForCustomerReply) {
    return { ...payload, runAfter: "customer_reply" };
  }
  return payload;
}

function stepsToDraft(steps: unknown[]): StepDraft[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [emptyStep()];
  }

  return steps.map((raw) => {
    const step = raw as Record<string, unknown>;
    const type = (step.type as StepType) ?? "SEND_TEXT_REPLY";
    return {
      id: crypto.randomUUID(),
      type,
      tagName: typeof step.tagName === "string" ? step.tagName : "",
      memberId: typeof step.memberId === "string" ? step.memberId : "",
      priority: typeof step.priority === "string" ? step.priority : "NORMAL",
      text: typeof step.text === "string" ? step.text : "",
      imageUrl: typeof step.imageUrl === "string" ? step.imageUrl : "",
      savedReplyId: typeof step.savedReplyId === "string" ? step.savedReplyId : "",
      delaySeconds:
        typeof step.delaySeconds === "number" ? String(step.delaySeconds) : "60",
      waitForCustomerReply: step.runAfter === "customer_reply"
    };
  });
}

function draftToPayload(steps: StepDraft[]): unknown[] {
  return steps.map((step, index) => {
    switch (step.type) {
      case "ADD_TAG":
        return appendRunAfter(
          { type: step.type, tagName: step.tagName.trim() },
          index,
          step.waitForCustomerReply
        );
      case "ASSIGN_AGENT":
        return appendRunAfter(
          { type: step.type, memberId: step.memberId },
          index,
          step.waitForCustomerReply
        );
      case "SET_PRIORITY":
        return appendRunAfter(
          { type: step.type, priority: step.priority },
          index,
          step.waitForCustomerReply
        );
      case "SEND_TEXT_REPLY":
        return appendRunAfter(
          { type: step.type, text: step.text.trim() },
          index,
          step.waitForCustomerReply
        );
      case "SEND_IMAGE_REPLY":
        return appendRunAfter(
          { type: step.type, imageUrl: step.imageUrl.trim() },
          index,
          step.waitForCustomerReply
        );
      case "SEND_SAVED_REPLY":
        return appendRunAfter(
          { type: step.type, savedReplyId: step.savedReplyId },
          index,
          step.waitForCustomerReply
        );
      case "WAIT":
        return appendRunAfter(
          { type: step.type, delaySeconds: Number(step.delaySeconds) || 60 },
          index,
          step.waitForCustomerReply
        );
      case "CLOSE_CONVERSATION":
      case "ESCALATE":
        return appendRunAfter({ type: step.type }, index, step.waitForCustomerReply);
      default:
        return appendRunAfter(
          { type: "SEND_TEXT_REPLY", text: step.text.trim() },
          index,
          step.waitForCustomerReply
        );
    }
  });
}

function toForm(rule: AutomationRule): FormState {
  return {
    name: rule.name,
    priority: String(rule.priority),
    isEnabled: rule.isEnabled,
    triggerType: rule.triggerType,
    triggerKeywords: rule.triggerKeywords.join(", "),
    triggerTagNames: rule.triggerTagNames.join(", "),
    triggerStatus: rule.triggerStatus ?? "RESOLVED",
    offHourStart:
      rule.offHourStart === null || rule.offHourStart === undefined
        ? ""
        : String(rule.offHourStart),
    offHourEnd:
      rule.offHourEnd === null || rule.offHourEnd === undefined
        ? ""
        : String(rule.offHourEnd),
    lineChannelId: rule.lineChannelId ?? "",
    steps: stepsToDraft(rule.steps)
  };
}

export function AutomationManager() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const triggerOptions = useMemo(() => getAutomationTriggerOptions(locale), [locale]);
  const stepOptions = useMemo(() => getAutomationStepOptions(locale), [locale]);
  const { user } = useAuthSession();
  const role = user?.role ?? "AGENT";
  const workspaceId = user?.workspaceId ?? null;
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("all");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canManageAutomation(role);

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

  useEffect(() => {
    async function loadSavedReplies() {
      try {
        const data = await apiFetch<SavedReply[]>("/api/v1/inbox/saved-replies");
        setSavedReplies(Array.isArray(data) ? data : []);
      } catch {
        setSavedReplies([]);
      }
    }
    void loadSavedReplies();
  }, []);

  async function loadRules(channelFilter: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (channelFilter !== "all") {
        params.set("lineChannelId", channelFilter);
      }
      const query = params.toString();
      const path = query
        ? `/api/v1/automation/rules?${query}`
        : "/api/v1/automation/rules";
      const data = await apiFetch<AutomationRule[]>(path);
      setRules(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(readMessage(loadError, t.loadAutomationError));
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRules(selectedChannelId);
  }, [selectedChannelId]);

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    [rules]
  );

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setForm(toForm(rule));
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
      triggerType: form.triggerType,
      triggerKeywords: parseCommaList(form.triggerKeywords),
      triggerTagNames: parseCommaList(form.triggerTagNames),
      triggerStatus:
        form.triggerType === "STATUS_CHANGED" ? form.triggerStatus.trim() : undefined,
      offHourStart:
        form.triggerType === "OFF_HOURS" && form.offHourStart !== ""
          ? Number(form.offHourStart)
          : undefined,
      offHourEnd:
        form.triggerType === "OFF_HOURS" && form.offHourEnd !== ""
          ? Number(form.offHourEnd)
          : undefined,
      lineChannelId: form.lineChannelId || undefined,
      steps: draftToPayload(form.steps)
    };

    try {
      if (editingId) {
        await apiFetch(`/api/v1/automation/rules/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/api/v1/automation/rules", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetForm();
      await loadRules(selectedChannelId);
    } catch (saveError) {
      setError(readMessage(saveError, t.saveAutomationError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit || !window.confirm(t.deleteAutomationConfirm)) {
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/v1/automation/rules/${id}`, { method: "DELETE" });
      if (editingId === id) {
        resetForm();
      }
      await loadRules(selectedChannelId);
    } catch (deleteError) {
      setError(readMessage(deleteError, t.deleteAutomationError));
    }
  }

  function updateStep(stepId: string, patch: Partial<StepDraft>) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step
      )
    }));
  }

  function removeStep(stepId: string) {
    setForm((current) => ({
      ...current,
      steps:
        current.steps.length <= 1
          ? current.steps
          : current.steps.filter((step) => step.id !== stepId)
    }));
  }

  function applyTemplate(template: "off_hours_welcome" | "faq_handoff") {
    setEditingId(null);
    setError(null);

    if (template === "off_hours_welcome") {
      setForm({
        ...emptyForm,
        name: t.automationTemplateOffHoursName,
        priority: "50",
        isEnabled: true,
        triggerType: "OFF_HOURS",
        offHourStart: "8",
        offHourEnd: "23",
        steps: [
          {
            ...emptyStep(),
            type: "SEND_TEXT_REPLY",
            text: t.automationTemplateOffHoursText
          }
        ]
      });
      return;
    }

    setForm({
      ...emptyForm,
      name: t.automationTemplateFaqName,
      priority: "60",
      isEnabled: true,
      triggerType: "MESSAGE_RECEIVED",
      triggerKeywords: t.automationTemplateFaqKeywords,
      steps: [
        {
          ...emptyStep(),
          type: "SEND_TEXT_REPLY",
          text: t.automationTemplateFaqText
        },
        {
          ...emptyStep(),
          type: "ADD_TAG",
          tagName: t.automationTemplateFaqTag,
          waitForCustomerReply: true
        }
      ]
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#DEDDE6] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Workflow size={18} className="text-[#4636D7]" />
          <h2 className="text-lg font-semibold text-[#16182B]">{t.automationRulesTitle}</h2>
        </div>
        <p className="mb-4 text-sm text-[#767A8C]">{t.automationRulesHint}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={selectedChannelId}
            onChange={(event) => setSelectedChannelId(event.target.value)}
            className="rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
          >
            <option value="all">{t.allChannels}</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        {isLoading ? <p className="text-sm text-[#767A8C]">{t.loadingRules}</p> : null}

        <ul className="space-y-3">
          {sortedRules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#ECEAF3] p-4"
            >
              <div>
                <p className="font-medium text-[#16182B]">
                  {rule.name}{" "}
                  <span className="text-xs text-[#767A8C]">#{rule.priority}</span>
                </p>
                <p className="text-xs text-[#767A8C]">
                  {t.triggerSummary}: {rule.triggerType} · {t.stepsSummary}:{" "}
                  {Array.isArray(rule.steps) ? rule.steps.length : 0}
                  {ruleHasReplyDrivenSteps(rule.steps)
                    ? ` · ${t.automationReplyDrivenBadge}`
                    : ""}
                  {!rule.isEnabled ? ` · ${t.disabled}` : ""}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => handleEdit(rule)}>
                    <Pencil size={14} />
                  </Button>
                  <Button type="button" variant="danger" onClick={() => void handleDelete(rule.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {canEdit ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[#DEDDE6] bg-white p-5 shadow-sm"
        >
          <h3 className="text-base font-semibold text-[#16182B]">
            {editingId ? t.editAutomationRule : t.newAutomationRule}
          </h3>

          {!editingId ? (
            <div className="space-y-2">
              <p className="text-sm text-[#767A8C]">{t.automationTemplatesLabel}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => applyTemplate("off_hours_welcome")}
                >
                  {t.automationTemplateOffHoursWelcome}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => applyTemplate("faq_handoff")}
                >
                  {t.automationTemplateFaqHandoff}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="auto-name">{t.nameLabel}</Label>
              <Input
                id="auto-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="auto-priority">{t.priorityLabel}</Label>
              <Input
                id="auto-priority"
                type="number"
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="auto-trigger">{t.triggerLabel}</Label>
              <select
                id="auto-trigger"
                value={form.triggerType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    triggerType: event.target.value as AutomationTriggerType
                  })
                }
                className="w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
              >
                {triggerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="auto-channel">{t.channelScope}</Label>
              <select
                id="auto-channel"
                value={form.lineChannelId}
                onChange={(event) => setForm({ ...form, lineChannelId: event.target.value })}
                className="w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
              >
                <option value="">{t.allChannels}</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(form.triggerType === "MESSAGE_RECEIVED" || form.triggerType === "OFF_HOURS") && (
            <div>
              <Label htmlFor="auto-keywords">{t.keywordsCommaEmptyAny}</Label>
              <Input
                id="auto-keywords"
                value={form.triggerKeywords}
                onChange={(event) => setForm({ ...form, triggerKeywords: event.target.value })}
              />
            </div>
          )}

          {form.triggerType === "TAG_ADDED" && (
            <div>
              <Label htmlFor="auto-tags">{t.tagNamesComma}</Label>
              <Input
                id="auto-tags"
                value={form.triggerTagNames}
                onChange={(event) => setForm({ ...form, triggerTagNames: event.target.value })}
              />
            </div>
          )}

          {form.triggerType === "STATUS_CHANGED" && (
            <div>
              <Label htmlFor="auto-status">{t.statusLabel}</Label>
              <select
                id="auto-status"
                value={form.triggerStatus}
                onChange={(event) => setForm({ ...form, triggerStatus: event.target.value })}
                className="w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
              >
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </div>
          )}

          {form.triggerType === "OFF_HOURS" && (
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="auto-open-start">{t.businessHoursStart}</Label>
                  <Input
                    id="auto-open-start"
                    type="number"
                    min={0}
                    max={23}
                    value={form.offHourStart}
                    onChange={(event) => setForm({ ...form, offHourStart: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="auto-open-end">{t.businessHoursEnd}</Label>
                  <Input
                    id="auto-open-end"
                    type="number"
                    min={0}
                    max={23}
                    value={form.offHourEnd}
                    onChange={(event) => setForm({ ...form, offHourEnd: event.target.value })}
                    required
                  />
                </div>
              </div>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {t.autoOffHoursHint
                  .replace("{start}", form.offHourStart || "0")
                  .replace("{end}", form.offHourEnd || "0")}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t.stepsRunInOrder}</Label>
                <p className="mt-1 text-xs text-[#767A8C]">{t.automationStepsHint}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    steps: [...current.steps, emptyStep()]
                  }))
                }
              >
                <Plus size={14} className="mr-1" />
                {t.addStep}
              </Button>
            </div>

            {form.steps.map((step, index) => (
              <div
                key={step.id}
                className="rounded-lg border border-[#ECEAF3] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#767A8C]">
                    {t.stepN} {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    className="text-[#767A8C] hover:text-red-600"
                    aria-label={t.removeStep}
                  >
                    <X size={14} />
                  </button>
                </div>
                <select
                  value={step.type}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    updateStep(step.id, { type: event.target.value as StepType })
                  }
                  className="w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
                >
                  {stepOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {step.type === "SEND_TEXT_REPLY" && (
                  <textarea
                    value={step.text}
                    onChange={(event) => updateStep(step.id, { text: event.target.value })}
                    className="min-h-[80px] w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
                    placeholder={t.replyTextPlaceholder}
                    required
                  />
                )}

                {step.type === "SEND_IMAGE_REPLY" && (
                  <Input
                    value={step.imageUrl}
                    onChange={(event) => updateStep(step.id, { imageUrl: event.target.value })}
                    placeholder={t.imageUrlPlaceholder}
                    type="url"
                    required
                  />
                )}

                {step.type === "SEND_SAVED_REPLY" && (
                  <select
                    value={step.savedReplyId}
                    onChange={(event) =>
                      updateStep(step.id, { savedReplyId: event.target.value })
                    }
                    className="w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
                    required
                  >
                    <option value="">{t.selectSavedReply}</option>
                    {savedReplies.map((reply) => (
                      <option key={reply.id} value={reply.id}>
                        {reply.title}
                      </option>
                    ))}
                  </select>
                )}

                {step.type === "ADD_TAG" && (
                  <Input
                    value={step.tagName}
                    onChange={(event) => updateStep(step.id, { tagName: event.target.value })}
                    placeholder={t.tagNamePlaceholder}
                    required
                  />
                )}

                {step.type === "ASSIGN_AGENT" && (
                  <select
                    value={step.memberId}
                    onChange={(event) => updateStep(step.id, { memberId: event.target.value })}
                    className="w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
                    required
                  >
                    <option value="">{t.selectAgent}</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.user.displayName || member.user.email}
                      </option>
                    ))}
                  </select>
                )}

                {step.type === "SET_PRIORITY" && (
                  <select
                    value={step.priority}
                    onChange={(event) => updateStep(step.id, { priority: event.target.value })}
                    className="w-full rounded-lg border border-[#DEDDE6] px-3 py-2 text-sm"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                )}

                {step.type === "WAIT" && (
                  <>
                    <Input
                      type="number"
                      min={1}
                      max={86400}
                      value={step.delaySeconds}
                      onChange={(event) =>
                        updateStep(step.id, { delaySeconds: event.target.value })
                      }
                      placeholder={t.delaySecondsPlaceholder}
                      required
                    />
                    <p className="text-xs text-[#767A8C]">{t.automationWaitStepHint}</p>
                  </>
                )}

                {index > 0 ? (
                  <div className="space-y-1 rounded-lg bg-[#F8F7FB] px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-[#16182B]">
                      <input
                        type="checkbox"
                        checked={step.waitForCustomerReply}
                        onChange={(event) =>
                          updateStep(step.id, {
                            waitForCustomerReply: event.target.checked
                          })
                        }
                      />
                      {t.automationStepWaitForReplyLabel}
                    </label>
                    <p className="text-xs text-[#767A8C]">
                      {step.waitForCustomerReply
                        ? t.automationStepWaitForReplyHint
                        : t.automationStepImmediateHint}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
            />
            {t.enabled}
          </label>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t.saving : editingId ? t.updateRule : t.createRule}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                {t.cancelEdit}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
