"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Label } from "@omnichat/ui";
import {
  Filter,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  FileCheck2,
} from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";
import { useRouter } from "next/navigation";
import { isOwnerOrAdmin } from "../../lib/settings-rbac";
import { useAuthSession } from "../../lib/use-auth-session";
import Link from "next/link";

interface LineChannel {
  id: string;
  name: string;
}

interface SlipVerification {
  id: string;
  conversationId: string;
  bankName: string | null;
  amount: number | null;
  transactionRef: string | null;
  transferDate: string | null;
  slipScore: number;
  qrDecodeStatus: string;
  verifyStatus: string;
  verifyErrorCode: string | null;
  createdAt: string;
  imageUrl?: string | null;
  conversation: {
    id: string;
    displayName: string | null;
    lineChannelId: string;
    lineChannel: {
      name: string;
    };
    customer: {
      displayName: string | null;
    } | null;
  };
}

interface VerificationsResponse {
  items: SlipVerification[];
  total: number;
  summary: {
    verifiedCount: number;
    invalidCount: number;
    duplicateCount: number;
    pendingCount: number;
  };
}

export default function SlipVerificationDashboard() {
  const { locale } = useLanguage();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuthSession();
  const role = user?.role ?? null;

  // State
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerificationsResponse | null>(null);

  // Authenticate role
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!isOwnerOrAdmin(role)) {
      router.push("/app/inbox");
    }
  }, [isAuthLoading, user, role, router]);

  // Load dropdown options
  useEffect(() => {
    if (!user || !isOwnerOrAdmin(role)) return;

    const loadChannels = async () => {
      try {
        const channelsData = await apiFetch<LineChannel[]>("/api/v1/line/channels");
        setChannels(channelsData || []);
      } catch (err) {
        console.error("Failed to load Line channels", err);
      }
    };

    void loadChannels();
  }, [user, role]);

  // Fetch verifications
  const loadVerifications = async () => {
    if (!user || !isOwnerOrAdmin(role)) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (selectedChannel) params.append("lineChannelId", selectedChannel);
      if (statusFilter) params.append("verifyStatus", statusFilter);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (searchQuery) params.append("search", searchQuery);

      const response = await apiFetch<VerificationsResponse>(
        `/api/v1/slip/verifications?${params.toString()}`
      );
      setData(response);
    } catch (err) {
      setError(
        locale === "th" ? "ไม่สามารถโหลดข้อมูลการตรวจสอบสลิปได้" : "Failed to load slip verifications"
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadVerifications();
  }, [selectedChannel, statusFilter, dateFrom, dateTo, page, user, role]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void loadVerifications();
  };

  const handleClearFilters = () => {
    setSelectedChannel("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    setPage(1);
  };

  if (isAuthLoading || !user || !isOwnerOrAdmin(role)) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const summary = data?.summary || { verifiedCount: 0, invalidCount: 0, duplicateCount: 0, pendingCount: 0 };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
            {locale === "th" ? "แดชบอร์ดตรวจสอบสลิป" : "Slip Verification Dashboard"}
          </h1>
          <p className="text-sm text-slate-500">
            {locale === "th"
              ? "ดูประวัติ คัดกรอง และประมวลผลการตรวจสอบสลิปอัตโนมัติภายในระบบ"
              : "Review, filter, and track slip validation logs across your channels."}
          </p>
        </div>
        <Button
          onClick={() => void loadVerifications()}
          variant="secondary"
          size="sm"
          className="w-fit self-end bg-white font-semibold text-slate-700 shadow-sm border border-slate-200"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {locale === "th" ? "รีเฟรชข้อมูล" : "Refresh"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Verified */}
        <Card className="flex flex-col justify-between border-l-4 border-l-emerald-500 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {locale === "th" ? "ตรวจสอบผ่าน (วันนี้)" : "Verified (Today)"}
            </span>
            <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">{summary.verifiedCount}</span>
            <p className="mt-1 text-xs text-slate-400">
              {locale === "th" ? "ทำรายการผ่านสำเร็จ" : "Successful validations"}
            </p>
          </div>
        </Card>

        {/* Invalid */}
        <Card className="flex flex-col justify-between border-l-4 border-l-rose-500 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {locale === "th" ? "ไม่ผ่าน / รูปไม่ตรง (วันนี้)" : "Invalid (Today)"}
            </span>
            <div className="rounded-full bg-rose-50 p-2 text-rose-600">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">{summary.invalidCount}</span>
            <p className="mt-1 text-xs text-slate-400">
              {locale === "th" ? "ข้อมูลไม่ถูกต้อง (Error 1)" : "Invalid/corrupt slips"}
            </p>
          </div>
        </Card>

        {/* Duplicate */}
        <Card className="flex flex-col justify-between border-l-4 border-l-amber-500 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {locale === "th" ? "สลิปซ้ำ (วันนี้)" : "Duplicate (Today)"}
            </span>
            <div className="rounded-full bg-amber-50 p-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">{summary.duplicateCount}</span>
            <p className="mt-1 text-xs text-slate-400">
              {locale === "th" ? "สลิปที่ถูกโอนซ้ำ" : "Double-spent transaction"}
            </p>
          </div>
        </Card>

        {/* Pending / Manual Review */}
        <Card className="flex flex-col justify-between border-l-4 border-l-sky-500 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {locale === "th" ? "รอแอดมินตรวจ (วันนี้)" : "Manual Review (Today)"}
            </span>
            <div className="rounded-full bg-sky-50 p-2 text-sky-600">
              <HelpCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">{summary.pendingCount}</span>
            <p className="mt-1 text-xs text-slate-400">
              {locale === "th" ? "ระบบขัดข้อง/ตรวจสอบมือ (Error 2)" : "Awaiting manual verification"}
            </p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Panel */}
      <Card className="mb-6 bg-white p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">
              {locale === "th" ? "ค้นหาและตัวกรอง" : "Filter Operations"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            {/* Search Input */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search-input" className="text-xs font-semibold text-slate-500">
                {locale === "th" ? "ค้นหาชื่อ / เลขอ้างอิง" : "Search Name / Ref No."}
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="search-input"
                  type="text"
                  placeholder={locale === "th" ? "พิมพ์คำค้นหา..." : "Search..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-50/50"
                />
              </div>
            </div>

            {/* Line Channel Select */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="channel-select" className="text-xs font-semibold text-slate-500">
                LINE Channel
              </Label>
              <select
                id="channel-select"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="h-10 rounded-md border border-input bg-slate-50/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{locale === "th" ? "ทั้งหมด" : "All Channels"}</option>
                {channels.map((chan) => (
                  <option key={chan.id} value={chan.id}>
                    {chan.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status-select" className="text-xs font-semibold text-slate-500">
                {locale === "th" ? "สถานะการตรวจสอบ" : "Verification Status"}
              </Label>
              <select
                id="status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-slate-50/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{locale === "th" ? "ทั้งหมด" : "All Statuses"}</option>
                <option value="VERIFIED">{locale === "th" ? "ผ่านสำเร็จ (VERIFIED)" : "Verified"}</option>
                <option value="INVALID">{locale === "th" ? "ไม่ผ่าน (INVALID)" : "Invalid"}</option>
                <option value="DUPLICATE">{locale === "th" ? "ซ้ำซ้อน (DUPLICATE)" : "Duplicate"}</option>
                <option value="MANUAL_REVIEW">{locale === "th" ? "รอแอดมิน (MANUAL_REVIEW)" : "Manual Review"}</option>
                <option value="PENDING">{locale === "th" ? "กำลังรอผล (PENDING)" : "Pending"}</option>
              </select>
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date-from" className="text-xs font-semibold text-slate-500">
                {locale === "th" ? "ตั้งแต่วันที่" : "Date From"}
              </Label>
              <div className="relative">
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-slate-50/50"
                />
              </div>
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date-to" className="text-xs font-semibold text-slate-500">
                {locale === "th" ? "ถึงวันที่" : "Date To"}
              </Label>
              <div className="relative">
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-slate-500 hover:text-slate-900"
            >
              {locale === "th" ? "ล้างตัวกรอง" : "Clear Filters"}
            </Button>
            <Button type="submit" size="sm" className="font-semibold">
              {locale === "th" ? "ค้นหา" : "Search"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Main Data Table */}
      <Card className="overflow-hidden bg-white shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-slate-400">
              {locale === "th" ? "กำลังโหลดข้อมูล..." : "Loading records..."}
            </span>
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center p-6 text-center">
            <span className="text-sm font-semibold text-rose-500">{error}</span>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-slate-400">
            <FileCheck2 className="mb-2 h-8 w-8 text-slate-300" />
            <span className="text-sm font-medium">
              {locale === "th" ? "ไม่พบข้อมูลประวัติสลิป" : "No slip verification logs found"}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">{locale === "th" ? "วันที่ / เวลา" : "Date & Time"}</th>
                  <th className="px-6 py-4">{locale === "th" ? "รูปสลิป" : "Slip Image"}</th>
                  <th className="px-6 py-4">{locale === "th" ? "ลูกค้า" : "Customer"}</th>
                  <th className="px-6 py-4">LINE Channel</th>
                  <th className="px-6 py-4">{locale === "th" ? "ธนาคาร / ยอดโอน" : "Bank & Amount"}</th>
                  <th className="px-6 py-4">{locale === "th" ? "รหัสอ้างอิง" : "Ref Number"}</th>
                  <th className="px-6 py-4">{locale === "th" ? "คะแนนสลิป" : "Score"}</th>
                  <th className="px-6 py-4">{locale === "th" ? "สถานะ QR" : "QR Status"}</th>
                  <th className="px-6 py-4">{locale === "th" ? "สถานะทวนสอบ" : "Status"}</th>
                  <th className="px-6 py-4 text-center">{locale === "th" ? "เปิดห้องแชท" : "Open Chat"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((item) => {
                  // Format Date
                  const dateStr = new Date(item.createdAt).toLocaleString(
                    locale === "th" ? "th-TH" : "en-US",
                    {
                      dateStyle: "short",
                      timeStyle: "short",
                    }
                  );

                  // QR Status Class
                  const qrSuccess = item.qrDecodeStatus === "SUCCESS";
                  const qrBadgeClass = qrSuccess
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-rose-50 text-rose-700 border-rose-100";

                  // Verify Status Class
                  let statusBadgeClass = "bg-slate-50 text-slate-700 border-slate-100";
                  let statusText = item.verifyStatus;
                  if (item.verifyStatus === "VERIFIED") {
                    statusBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                    statusText = locale === "th" ? "ถูกต้อง" : "Verified";
                  } else if (item.verifyStatus === "INVALID") {
                    statusBadgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                    statusText = locale === "th" ? "ไม่ถูกต้อง (Error 1)" : "Invalid (Error 1)";
                  } else if (item.verifyStatus === "DUPLICATE") {
                    statusBadgeClass = "bg-amber-50 text-amber-700 border-amber-100";
                    statusText = locale === "th" ? "โอนซ้ำ" : "Duplicate";
                  } else if (item.verifyStatus === "MANUAL_REVIEW") {
                    statusBadgeClass = "bg-sky-50 text-sky-700 border-sky-100";
                    statusText = locale === "th" ? "รอตรวจ (Error 2)" : "Manual Review (Error 2)";
                  }

                  // Amount format
                  const displayAmount =
                    item.amount !== null
                      ? `${item.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ฿`
                      : "-";

                  // Customer name
                  const customerName =
                    item.conversation.customer?.displayName ||
                    item.conversation.displayName ||
                    (locale === "th" ? "ลูกค้าทั่วไป" : "Unnamed customer");

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      {/* Date */}
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                        {dateStr}
                      </td>

                      {/* Slip Image */}
                      <td className="whitespace-nowrap px-6 py-4">
                        {item.imageUrl ? (
                          <a
                            href={item.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block relative h-10 w-10 overflow-hidden rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:scale-105 transition-all"
                          >
                            <img
                              src={item.imageUrl}
                              alt="Slip Thumbnail"
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400">
                            No Img
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {customerName}
                      </td>

                      {/* Line Channel */}
                      <td className="whitespace-nowrap px-6 py-4">
                        {item.conversation.lineChannel.name}
                      </td>

                      {/* Bank & Amount */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-semibold text-slate-950">{displayAmount}</div>
                        {item.bankName && <div className="text-xs text-slate-400">{item.bankName}</div>}
                      </td>

                      {/* Reference Number */}
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                        {item.transactionRef || "-"}
                      </td>

                      {/* Score */}
                      <td className="whitespace-nowrap px-6 py-4 font-medium">
                        <span
                          className={
                            item.slipScore >= 60 ? "text-emerald-600 font-bold" : "text-rose-500"
                          }
                        >
                          {item.slipScore.toFixed(0)}%
                        </span>
                      </td>

                      {/* QR status */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold leading-4 ${qrBadgeClass}`}
                        >
                          {qrSuccess ? "Success" : "Failed"}
                        </span>
                      </td>

                      {/* Verify status */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold leading-4 ${statusBadgeClass}`}
                        >
                          {statusText}
                        </span>
                      </td>

                      {/* Open Chat Link */}
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <Link
                          href={`/app/inbox?conversationId=${item.conversationId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-indigo-900 hover:underline"
                        >
                          {locale === "th" ? "เปิดห้องแชท" : "Open Chat"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
            <span className="text-xs text-slate-500">
              {locale === "th"
                ? `แสดงหน้า ${page} จากทั้งหมด ${totalPages} หน้า (จำนวนทั้งหมด ${data.total} รายการ)`
                : `Showing page ${page} of ${totalPages} pages (total ${data.total} records)`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="bg-white border-slate-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="bg-white border-slate-200"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
