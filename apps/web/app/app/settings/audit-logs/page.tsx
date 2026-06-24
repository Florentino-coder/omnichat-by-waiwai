"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, ScrollText } from "lucide-react";
import { Badge, Button, Card, Label } from "@omnichat/ui";
import { apiFetch, authorizedFetch } from "../../../lib/api-client";
import {
  AUDIT_LOG_CATEGORIES,
  formatAuditAction,
  getAuditCategoryLabel,
  summarizeMetadata,
  type AuditLogCategory
} from "../../../lib/audit-log-labels";
import { useLanguage } from "../../../lib/language-context";
import { getMessages } from "../../../lib/i18n";
import { isOwnerOrAdmin } from "../../../lib/settings-rbac";
import { useAuthSession } from "../../../lib/use-auth-session";

type AuditLogRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: {
    id: string;
    displayName: string;
    email: string;
  } | null;
};

type ListResponse = {
  success: boolean;
  data: AuditLogRow[];
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
};

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const { user, isLoading: isAuthLoading } = useAuthSession();

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [category, setCategory] = useState<AuditLogCategory | "">("");
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canView = isOwnerOrAdmin(user?.role ?? null);
  const canExport = user?.role === "OWNER";

  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    start.setUTCDate(start.getUTCDate() - days);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }, [range]);

  const loadLogs = useCallback(async () => {
    if (!canView) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        from,
        to
      });
      if (category) {
        params.set("category", category);
      }
      const response = await apiFetch<ListResponse>(`/api/v1/audit-logs?${params.toString()}`);
      setRows(response.data ?? []);
      setTotal(response.meta?.total ?? response.data?.length ?? 0);
    } catch {
      setError(t.auditLogsLoadError);
      setRows([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [canView, page, limit, from, to, category, t.auditLogsLoadError]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!canView) {
      router.replace("/app/settings");
      return;
    }
    void loadLogs();
  }, [isAuthLoading, canView, router, loadLogs]);

  const handleExport = async () => {
    if (!canExport) {
      return;
    }
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (category) {
        params.set("category", category);
      }
      const response = await authorizedFetch(`/api/v1/audit-logs/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `audit-logs-${to}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.auditLogsExportError);
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isAuthLoading || !canView) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#4636D7]" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F7F7FA] p-4 sm:p-6 md:p-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 border-b border-[#DEDDE6]/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/app/settings"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#767A8C] hover:text-[#4636D7]"
            >
              <ArrowLeft size={16} />
              {t.settingsTitle}
            </Link>
            <div className="flex items-center gap-3">
              <ScrollText className="text-[#4636D7]" size={28} />
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#16182B]">
                  {t.auditLogsTitle}
                </h1>
                <p className="text-sm text-[#767A8C]">{t.auditLogsSubtitle}</p>
              </div>
            </div>
          </div>
          {canExport ? (
            <Button type="button" variant="secondary" disabled={isExporting} onClick={() => void handleExport()}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {t.auditLogsExport}
            </Button>
          ) : null}
        </div>

        <Card className="space-y-4 border-[#DEDDE6] p-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label>{t.auditLogsRange}</Label>
              <div className="flex gap-2">
                {(["7d", "30d", "90d"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setRange(value);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      range === value
                        ? "bg-[#4636D7] text-white"
                        : "bg-[#F6F5FA] text-[#767A8C] hover:bg-[#ECEBFF]"
                    }`}
                  >
                    {value === "7d" ? t.auditLogsRange7d : value === "30d" ? t.auditLogsRange30d : t.auditLogsRange90d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="audit-category">{t.auditLogsCategory}</Label>
              <select
                id="audit-category"
                value={category}
                onChange={(event) => {
                  setPage(1);
                  setCategory(event.target.value as AuditLogCategory | "");
                }}
                className="h-10 min-w-[200px] rounded-lg border border-[#DEDDE6] bg-white px-3 text-sm"
              >
                <option value="">{t.auditLogsCategoryAll}</option>
                {AUDIT_LOG_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {getAuditCategoryLabel(value, locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {error ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>
        ) : null}

        <Card className="overflow-hidden border-[#DEDDE6]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[#4636D7]" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#767A8C]">{t.auditLogsEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#F6F5FA] text-xs uppercase tracking-wide text-[#767A8C]">
                  <tr>
                    <th className="px-4 py-3">{t.auditLogsColTime}</th>
                    <th className="px-4 py-3">{t.auditLogsColActor}</th>
                    <th className="px-4 py-3">{t.auditLogsColAction}</th>
                    <th className="px-4 py-3">{t.auditLogsColTarget}</th>
                    <th className="px-4 py-3">{t.auditLogsColDetails}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-[#DEDDE6]/80">
                      <td className="whitespace-nowrap px-4 py-3 text-[#16182B]">
                        {new Date(row.createdAt).toLocaleString(locale === "th" ? "th-TH" : "en-US")}
                      </td>
                      <td className="px-4 py-3">
                        {row.actor ? (
                          <div>
                            <p className="font-medium text-[#16182B]">{row.actor.displayName}</p>
                            <p className="text-xs text-[#767A8C]">{row.actor.email}</p>
                          </div>
                        ) : (
                          <Badge variant="muted">{t.auditLogsSystemActor}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#4636D7]">
                        {formatAuditAction(row.action, locale)}
                      </td>
                      <td className="px-4 py-3 text-[#767A8C]">
                        {row.targetType ? `${row.targetType}` : "—"}
                        {row.targetId ? (
                          <p className="truncate text-xs">{row.targetId}</p>
                        ) : null}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-[#767A8C]">
                        {summarizeMetadata(row.metadata) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-[#767A8C]">
            {t.auditLogsPagination
              .replace("{{page}}", String(page))
              .replace("{{totalPages}}", String(totalPages))
              .replace("{{total}}", String(total))}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t.auditLogsPrev}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              {t.auditLogsNext}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
