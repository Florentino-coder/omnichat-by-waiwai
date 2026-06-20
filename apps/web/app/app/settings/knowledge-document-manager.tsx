"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { FileText, Link2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";

type LineChannel = {
  id: string;
  name: string;
};

type KnowledgeDocument = {
  id: string;
  title: string;
  lineChannelId?: string | null;
  status: "PENDING" | "READY" | "FAILED";
  chunkCount: number;
  errorMessage?: string | null;
  updatedAt: string;
};

type IngestMode = "paste" | "file" | "url";

type FormState = {
  title: string;
  rawText: string;
  sourceUrl: string;
  lineChannelId: string;
};

const emptyForm: FormState = {
  title: "",
  rawText: "",
  sourceUrl: "",
  lineChannelId: ""
};

function readMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function statusLabel(
  status: KnowledgeDocument["status"],
  t: ReturnType<typeof getMessages>
): string {
  if (status === "READY") {
    return t.statusReady;
  }
  if (status === "FAILED") {
    return t.statusFailed;
  }
  return t.statusIndexing;
}

export function KnowledgeDocumentManager() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [role, setRole] = useState<string>("AGENT");
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("all");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [ingestMode, setIngestMode] = useState<IngestMode>("paste");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = role === "OWNER" || role === "ADMIN" || role === "AGENT";
  const canDelete = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("omnichat.user");
      if (stored) {
        const parsed = JSON.parse(stored) as { role?: string };
        setRole(parsed.role ?? "AGENT");
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

  async function loadDocuments(channelFilter: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (channelFilter !== "all") {
        params.set("lineChannelId", channelFilter);
      }
      const query = params.toString();
      const path = query
        ? `/api/v1/knowledge/documents?${query}`
        : "/api/v1/knowledge/documents";
      const data = await apiFetch<KnowledgeDocument[]>(path);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(readMessage(loadError, t.loadDocumentsError));
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments(selectedChannelId);
  }, [selectedChannelId]);

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
    [documents]
  );

  async function handlePasteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      rawText: form.rawText.trim(),
      lineChannelId: form.lineChannelId || undefined
    };

    try {
      await apiFetch("/api/v1/knowledge/documents", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setForm(emptyForm);
      setSelectedFile(null);
      await loadDocuments(selectedChannelId);
    } catch (saveError) {
      setError(readMessage(saveError, t.saveDocumentError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !selectedFile) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const body = new FormData();
    body.append("file", selectedFile);
    body.append("title", form.title.trim());
    if (form.lineChannelId) {
      body.append("lineChannelId", form.lineChannelId);
    }

    try {
      await apiFetch("/api/v1/knowledge/documents/upload", {
        method: "POST",
        body
      });
      setForm(emptyForm);
      setSelectedFile(null);
      await loadDocuments(selectedChannelId);
    } catch (saveError) {
      setError(readMessage(saveError, t.saveDocumentError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUrlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      sourceUrl: form.sourceUrl.trim(),
      lineChannelId: form.lineChannelId || undefined
    };

    try {
      await apiFetch("/api/v1/knowledge/documents/from-url", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setForm(emptyForm);
      setSelectedFile(null);
      await loadDocuments(selectedChannelId);
    } catch (saveError) {
      setError(readMessage(saveError, t.saveDocumentError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReindex(id: string) {
    if (!canEdit) {
      return;
    }

    setReindexingId(id);
    setError(null);
    try {
      await apiFetch(`/api/v1/knowledge/documents/${id}/reindex`, {
        method: "POST"
      });
      await loadDocuments(selectedChannelId);
    } catch (reindexError) {
      setError(readMessage(reindexError, t.reindexError));
    } finally {
      setReindexingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!canDelete || !window.confirm(t.deleteDocumentConfirm)) {
      return;
    }

    setError(null);
    try {
      await apiFetch(`/api/v1/knowledge/documents/${id}`, { method: "DELETE" });
      await loadDocuments(selectedChannelId);
    } catch (deleteError) {
      setError(readMessage(deleteError, t.deleteDocumentError));
    }
  }

  function updateFormField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  const channelFields = (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="doc-title">{t.docTitleLabel}</Label>
        <Input
          id="doc-title"
          name="title"
          value={form.title}
          onChange={updateFormField}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="doc-lineChannelId">{t.lineChannelOptional}</Label>
        <select
          id="doc-lineChannelId"
          name="lineChannelId"
          value={form.lineChannelId}
          onChange={updateFormField}
          className="w-full rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm"
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
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#ECEBFF] bg-[#F8F7FF] p-4 text-sm text-[#4636D7]">
        <div className="flex items-start gap-2">
          <FileText size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">{t.ragDocumentsTitle}</p>
            <p className="text-[#5B54A8]">{t.ragDocumentsHint}</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="document-channel-filter" className="text-sm font-medium text-[#16182B]">
          {t.channelScope}
        </Label>
        <select
          id="document-channel-filter"
          value={selectedChannelId}
          onChange={(event) => setSelectedChannelId(event.target.value)}
          className="rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm"
        >
          <option value="all">{t.allChannels}</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>

      {canEdit ? (
        <div className="space-y-4 rounded-xl border border-[#DEDDE6] p-4">
          <h3 className="font-semibold text-[#16182B]">{t.addDocumentTitle}</h3>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["paste", t.ingestPasteTab],
                ["file", t.ingestFileTab],
                ["url", t.ingestUrlTab]
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  ingestMode === mode
                    ? "bg-[#4636D7] text-white"
                    : "bg-[#F3F2FF] text-[#4636D7] hover:bg-[#ECEBFF]"
                ].join(" ")}
                onClick={() => setIngestMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {ingestMode === "paste" ? (
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              {channelFields}
              <div className="space-y-2">
                <Label htmlFor="doc-rawText">{t.docTextLabel}</Label>
                <textarea
                  id="doc-rawText"
                  name="rawText"
                  value={form.rawText}
                  onChange={updateFormField}
                  required
                  minLength={20}
                  rows={8}
                  className="w-full rounded-lg border border-[#DEDDE6] bg-white px-3 py-2 text-sm font-mono"
                  placeholder={t.docTextPlaceholder}
                />
              </div>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t.indexing : t.uploadAndIndex}
              </Button>
            </form>
          ) : null}

          {ingestMode === "file" ? (
            <form onSubmit={handleFileSubmit} className="space-y-4">
              {channelFields}
              <div className="space-y-2">
                <Label htmlFor="doc-file">{t.docFileLabel}</Label>
                <Input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  required
                />
                <p className="text-xs text-[#767A8C]">{t.docFileHint}</p>
              </div>
              <Button type="submit" disabled={isSaving || !selectedFile}>
                <Upload size={14} className="mr-1" />
                {isSaving ? t.indexing : t.uploadFileAndIndex}
              </Button>
            </form>
          ) : null}

          {ingestMode === "url" ? (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              {channelFields}
              <div className="space-y-2">
                <Label htmlFor="doc-sourceUrl">{t.docUrlLabel}</Label>
                <Input
                  id="doc-sourceUrl"
                  name="sourceUrl"
                  type="url"
                  value={form.sourceUrl}
                  onChange={updateFormField}
                  required
                  placeholder={t.docUrlPlaceholder}
                />
              </div>
              <Button type="submit" disabled={isSaving}>
                <Link2 size={14} className="mr-1" />
                {isSaving ? t.indexing : t.indexFromUrl}
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[#767A8C]">{t.onlyAgentCanAddDocs}</p>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-[#16182B]">
          {t.documentCount} ({sortedDocuments.length})
        </h3>
        {isLoading ? (
          <p className="text-sm text-[#767A8C]">{t.loading}</p>
        ) : sortedDocuments.length === 0 ? (
          <p className="text-sm text-[#767A8C]">{t.noDocumentsYet}</p>
        ) : (
          sortedDocuments.map((document) => (
            <div
              key={document.id}
              className="rounded-xl border border-[#DEDDE6] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-[#16182B]">{document.title}</h4>
                    <span className="rounded-full bg-[#ECEBFF] px-2 py-0.5 text-xs font-medium text-[#4636D7]">
                      {statusLabel(document.status, t)}
                    </span>
                    {document.status === "READY" ? (
                      <span className="text-xs text-[#767A8C]">{document.chunkCount} chunks</span>
                    ) : null}
                  </div>
                  {document.errorMessage ? (
                    <p className="text-xs text-red-600">{document.errorMessage}</p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={reindexingId === document.id}
                      onClick={() => void handleReindex(document.id)}
                    >
                      <RefreshCw size={14} className="mr-1" />
                      {reindexingId === document.id ? "..." : t.reindex}
                    </Button>
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDelete(document.id)}
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
