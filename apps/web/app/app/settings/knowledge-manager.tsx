"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { BookOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";

type LineChannel = {
  id: string;
  name: string;
  badgeColor?: string | null;
};

type KnowledgeArticle = {
  id: string;
  lineChannelId?: string | null;
  title: string;
  content: string;
  keywords: string[];
  category?: string | null;
  isActive: boolean;
};

type FormState = {
  title: string;
  content: string;
  keywords: string;
  category: string;
  lineChannelId: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  title: "",
  content: "",
  keywords: "",
  category: "",
  lineChannelId: "",
  isActive: true
};

function readMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function KnowledgeManager() {
  const [role, setRole] = useState<string>("AGENT");
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("all");
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  async function loadArticles(channelFilter: string, searchText: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (channelFilter !== "all") {
        params.set("lineChannelId", channelFilter);
      }
      if (searchText.trim()) {
        params.set("search", searchText.trim());
      }
      const query = params.toString();
      const path = query
        ? `/api/v1/knowledge/articles?${query}`
        : "/api/v1/knowledge/articles";
      const data = await apiFetch<KnowledgeArticle[]>(path);
      setArticles(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(readMessage(loadError, "Could not load knowledge articles."));
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles(selectedChannelId, search);
  }, [selectedChannelId, search]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => !article.isActive ? true : true);
  }, [articles]);

  function updateField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
      const value =
        field === "isActive"
          ? (event.target as HTMLInputElement).checked
          : event.target.value;
      setForm((current) => ({
        ...current,
        [field]: value
      }));
    };
  }

  function startCreate(): void {
    setEditingId("new");
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(article: KnowledgeArticle): void {
    setEditingId(article.id);
    setForm({
      title: article.title,
      content: article.content,
      keywords: article.keywords.join(", "),
      category: article.category || "",
      lineChannelId: article.lineChannelId || "",
      isActive: article.isActive
    });
    setError(null);
  }

  function cancelEdit(): void {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canEdit || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      keywords: form.keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      category: form.category.trim() || undefined,
      lineChannelId: form.lineChannelId || undefined,
      isActive: form.isActive
    };

    try {
      if (editingId && editingId !== "new") {
        await apiFetch<KnowledgeArticle>(`/api/v1/knowledge/articles/${editingId}`, {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        });
      } else {
        await apiFetch<KnowledgeArticle>("/api/v1/knowledge/articles", {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
      }

      cancelEdit();
      await loadArticles(selectedChannelId, search);
    } catch (saveError) {
      setError(readMessage(saveError, "Could not save knowledge article."));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteArticle(article: KnowledgeArticle): Promise<void> {
    if (!canDelete || isSaving) {
      return;
    }

    const confirmed = window.confirm(`Delete "${article.title}"?`);
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch<KnowledgeArticle>(`/api/v1/knowledge/articles/${article.id}`, {
        method: "DELETE"
      });
      if (editingId === article.id) {
        cancelEdit();
      }
      await loadArticles(selectedChannelId, search);
    } catch (deleteError) {
      setError(readMessage(deleteError, "Could not delete knowledge article."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#ECEBFF] bg-[#FAFAFF] p-4 text-sm text-[#4B4F63]">
        <div className="flex items-start gap-2">
          <BookOpen size={16} className="mt-0.5 text-[#4636D7]" />
          <p>
            Knowledge articles feed AI replies through <code className="font-mono text-[#4636D7]">{"{{knowledge_context}}"}</code>.
            Add product info, policies, and FAQs. AI picks top matches from customer messages.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <Input
          placeholder="Search title or content..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="h-11 rounded-xl border border-[#DEDDE6] bg-white px-3 text-sm text-[#16182B]"
          value={selectedChannelId}
          onChange={(event) => setSelectedChannelId(event.target.value)}
        >
          <option value="all">All channels + global</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {canEdit && editingId ? (
        <form
          onSubmit={saveArticle}
          className="space-y-4 rounded-2xl border border-[#DEDDE6] bg-[#FCFCFE] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-base font-semibold text-[#16182B]">
              {editingId === "new" ? "New Knowledge Article" : "Edit Knowledge Article"}
            </h3>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg p-2 text-[#767A8C] hover:bg-white hover:text-[#16182B]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kb-title">Title</Label>
              <Input id="kb-title" value={form.title} onChange={updateField("title")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-category">Category</Label>
              <Input
                id="kb-category"
                placeholder="Shipping, Pricing, FAQ..."
                value={form.category}
                onChange={updateField("category")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-keywords">Keywords (comma separated)</Label>
            <Input
              id="kb-keywords"
              placeholder="delivery, shipping, จัดส่ง"
              value={form.keywords}
              onChange={updateField("keywords")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-content">Content</Label>
            <textarea
              id="kb-content"
              className="min-h-[160px] w-full rounded-xl border border-[#DEDDE6] bg-white px-3 py-2 text-sm text-[#16182B] outline-none focus:border-[#4636D7]"
              value={form.content}
              onChange={updateField("content")}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kb-channel">Scope</Label>
              <select
                id="kb-channel"
                className="h-11 w-full rounded-xl border border-[#DEDDE6] bg-white px-3 text-sm"
                value={form.lineChannelId}
                onChange={updateField("lineChannelId")}
              >
                <option value="">All LINE channels</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-[#4B4F63]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={updateField("isActive")}
              />
              Active for AI retrieval
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Article"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#767A8C]">
          {isLoading ? "Loading..." : `${filteredArticles.length} article(s)`}
        </p>
        {canEdit && !editingId ? (
          <Button type="button" onClick={startCreate}>
            <Plus size={16} />
            Add Article
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        {filteredArticles.map((article) => (
          <div
            key={article.id}
            className="rounded-2xl border border-[#DEDDE6] bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-heading text-base font-semibold text-[#16182B]">
                    {article.title}
                  </h4>
                  {!article.isActive ? (
                    <span className="rounded-full bg-[#F3F3F6] px-2 py-0.5 text-xs font-medium text-[#767A8C]">
                      Inactive
                    </span>
                  ) : null}
                  {article.category ? (
                    <span className="rounded-full bg-[#ECEBFF] px-2 py-0.5 text-xs font-medium text-[#4636D7]">
                      {article.category}
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm text-[#4B4F63] line-clamp-4">
                  {article.content}
                </p>
                {article.keywords.length > 0 ? (
                  <p className="text-xs text-[#767A8C]">
                    Keywords: {article.keywords.join(", ")}
                  </p>
                ) : null}
              </div>
              {canEdit ? (
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="secondary" onClick={() => startEdit(article)}>
                    <Pencil size={14} />
                    Edit
                  </Button>
                  {canDelete ? (
                    <Button type="button" variant="danger" onClick={() => void deleteArticle(article)}>
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {!isLoading && filteredArticles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DEDDE6] bg-white px-6 py-10 text-center text-sm text-[#767A8C]">
            No knowledge articles yet. Add product info or FAQs so AI can answer with your data.
          </div>
        ) : null}
      </div>
    </div>
  );
}
