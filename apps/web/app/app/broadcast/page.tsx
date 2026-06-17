"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Label } from "@omnichat/ui";
import { Megaphone, Calendar, Clock, Send, Users, Info, AlertCircle, FileText, Image as ImageIcon, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";

type LineChannel = {
  id: string;
  name: string;
  badgeColor?: string | null;
  lineChannelId: string;
};

type BroadcastJob = {
  id: string;
  type: "BROADCAST" | "MULTICAST";
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  recipientCount: number | null;
  messages: any;
  scheduledAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export default function BroadcastPage() {
  const { locale } = useLanguage();
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [jobs, setJobs] = useState<BroadcastJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Form states
  const [type, setType] = useState<"BROADCAST" | "MULTICAST">("BROADCAST");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [multicastUserIds, setMulticastUserIds] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const channelsData = await apiFetch<LineChannel[]>("/api/v1/line/channels");
        setChannels(channelsData);
        if (channelsData.length > 0) {
          setSelectedChannelId(channelsData[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load LINE channels");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedChannelId) return;

    async function loadJobs() {
      try {
        const jobsData = await apiFetch<BroadcastJob[]>(`/api/v1/line/channels/${selectedChannelId}/broadcasts`);
        setJobs(jobsData);
      } catch (err) {
        console.error("Failed to load broadcast history", err);
      }
    }
    loadJobs();
    const interval = setInterval(loadJobs, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [selectedChannelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelId) {
      setError(locale === "th" ? "กรุณาเลือกช่องทาง LINE OA" : "Please select a LINE OA channel");
      return;
    }

    if (!text.trim() && !imageUrl.trim()) {
      setError(locale === "th" ? "กรุณาพิมพ์ข้อความหรือใส่ URL รูปภาพอย่างน้อยหนึ่งอย่าง" : "Please enter text or an image URL");
      return;
    }

    setIsSending(true);
    setError(null);
    setMessage(null);

    try {
      let scheduledAt: string | undefined = undefined;
      if (isScheduled && scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      }

      if (type === "BROADCAST") {
        await apiFetch(`/api/v1/line/channels/${selectedChannelId}/broadcast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            scheduledAt
          })
        });
        setMessage(
          isScheduled
            ? (locale === "th" ? "ตั้งเวลาบรอดแคสต์สำเร็จแล้ว!" : "Broadcast scheduled successfully!")
            : (locale === "th" ? "ส่งบรอดแคสต์สำเร็จแล้ว!" : "Broadcast sent successfully!")
        );
      } else {
        const to = multicastUserIds
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0);

        if (to.length === 0) {
          throw new Error(locale === "th" ? "กรุณากรอก User ID อย่างน้อยหนึ่งรายการสำหรับ Multicast" : "Please enter at least one User ID for Multicast");
        }

        await apiFetch(`/api/v1/line/channels/${selectedChannelId}/multicast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            text: text.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            scheduledAt
          })
        });
        setMessage(
          isScheduled
            ? (locale === "th" ? "ตั้งเวลาส่งมัลติแคสต์สำเร็จแล้ว!" : "Multicast scheduled successfully!")
            : (locale === "th" ? "ส่งมัลติแคสต์สำเร็จแล้ว!" : "Multicast sent successfully!")
        );
      }

      // Reset form
      setText("");
      setImageUrl("");
      setMulticastUserIds("");
      setIsScheduled(false);
      setScheduleDate("");
      setScheduleTime("");

      // Refresh jobs list
      const jobsData = await apiFetch<BroadcastJob[]>(`/api/v1/line/channels/${selectedChannelId}/broadcasts`);
      setJobs(jobsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create broadcast job");
    } finally {
      setIsSending(false);
    }
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <div className="h-full overflow-y-auto bg-[#F7F7FA] p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1.5 border-b border-[#DEDDE6]/60 pb-5">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#16182B]">
              {locale === "th" ? "ระบบบรอดแคสต์ (Broadcast)" : "Broadcast System"}
            </h1>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#2E7D32]">
              <Megaphone size={12} />
              LINE OA API
            </div>
          </div>
          <p className="text-sm text-[#767A8C]">
            {locale === "th"
              ? "ส่งข้อความข่าวสารหรือโปรโมชั่นหาลูกค้าจำนวนมากพร้อมกัน หรือตั้งเวลาส่งล่วงหน้า"
              : "Send messages or promotions to multiple customers at once or schedule them for later."}
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin text-[#4f46e5]" size={32} />
          </div>
        ) : channels.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto text-yellow-500 mb-3" size={48} />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {locale === "th" ? "ไม่พบช่องทางการเชื่อมต่อ LINE OA" : "No LINE OA Channels Connected"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {locale === "th"
                ? "คุณจำเป็นต้องเชื่อมต่อช่องทาง LINE OA ก่อนในเมนูตั้งค่าเพื่อเริ่มใช้งานระบบบรอดแคสต์"
                : "You need to connect a LINE OA channel first in the Settings menu to start broadcasting."}
            </p>
            <Button onClick={() => window.location.href = "/app/settings"}>
              {locale === "th" ? "ไปที่หน้าตั้งค่า" : "Go to Settings"}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-5 bg-white border border-[#DEDDE6]/60 shadow-sm rounded-xl">
                <h2 className="text-lg font-semibold text-[#16182B] mb-4 flex items-center gap-2">
                  <Send size={18} className="text-[#4f46e5]" />
                  {locale === "th" ? "สร้างแคมเปญใหม่" : "Create New Campaign"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Channel Selector */}
                  <div className="space-y-1.5">
                    <Label htmlFor="channel">
                      {locale === "th" ? "เลือกช่องทาง LINE OA" : "LINE OA Channel"}
                    </Label>
                    <select
                      id="channel"
                      className="flex h-10 w-full rounded-md border border-[#DEDDE6] bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={selectedChannelId}
                      onChange={(e) => setSelectedChannelId(e.target.value)}
                    >
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Broadcast Type */}
                  <div className="space-y-1.5">
                    <Label>{locale === "th" ? "ประเภทการส่ง" : "Delivery Type"}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setType("BROADCAST")}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg border transition-all ${
                          type === "BROADCAST"
                            ? "bg-[#ECEBFF] text-[#4636D7] border-[#4636D7]"
                            : "bg-white text-muted-foreground border-[#DEDDE6] hover:bg-secondary"
                        }`}
                      >
                        <Megaphone size={14} />
                        {locale === "th" ? "บรอดแคสต์ทุกคน" : "Broadcast All"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setType("MULTICAST")}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg border transition-all ${
                          type === "MULTICAST"
                            ? "bg-[#ECEBFF] text-[#4636D7] border-[#4636D7]"
                            : "bg-white text-muted-foreground border-[#DEDDE6] hover:bg-secondary"
                        }`}
                      >
                        <Users size={14} />
                        {locale === "th" ? "มัลติแคสต์ระบุรายชื่อ" : "Multicast Selected"}
                      </button>
                    </div>
                  </div>

                  {/* User IDs (only for Multicast) */}
                  {type === "MULTICAST" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="userIds">
                        {locale === "th" ? "LINE User IDs (คั่นด้วยจุลภาค ,)" : "LINE User IDs (comma separated)"}
                      </Label>
                      <textarea
                        id="userIds"
                        placeholder="U4af4980021..., U6bf4980022..."
                        className="flex min-h-[80px] w-full rounded-md border border-[#DEDDE6] bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]"
                        value={multicastUserIds}
                        onChange={(e) => setMulticastUserIds(e.target.value)}
                        required
                      />
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Info size={12} />
                        {locale === "th" ? "ส่งได้สูงสุดครั้งละ 500 บัญชี" : "Max 500 user accounts per send."}
                      </p>
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="text">{locale === "th" ? "ข้อความแชท" : "Message Text"}</Label>
                    <textarea
                      id="text"
                      placeholder={locale === "th" ? "พิมพ์ข้อความที่ต้องการส่ง..." : "Type broadcast message here..."}
                      className="flex min-h-[100px] w-full rounded-md border border-[#DEDDE6] bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </div>

                  {/* Image URL Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="imageUrl">{locale === "th" ? "ลิงก์รูปภาพ (HTTPS)" : "Image URL (HTTPS)"}</Label>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {locale === "th" ? "รูปภาพต้องขึ้นต้นด้วย https:// เท่านั้น" : "Image URL must start with https://"}
                    </p>
                  </div>

                  {/* Schedule Checkbox */}
                  <div className="flex items-center space-x-2 py-1">
                    <input
                      id="schedule"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-[#4f46e5] focus:ring-[#4f46e5]"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                    />
                    <Label htmlFor="schedule" className="cursor-pointer select-none">
                      {locale === "th" ? "ตั้งเวลาส่งล่วงหน้า (Schedule)" : "Schedule for later"}
                    </Label>
                  </div>

                  {/* Date & Time (Only if scheduled) */}
                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-[#DEDDE6]/50">
                      <div className="space-y-1.5">
                        <Label htmlFor="date" className="text-xs">
                          <Calendar size={12} className="inline mr-1" />
                          {locale === "th" ? "วันที่" : "Date"}
                        </Label>
                        <Input
                          id="date"
                          type="date"
                          required
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="time" className="text-xs">
                          <Clock size={12} className="inline mr-1" />
                          {locale === "th" ? "เวลา" : "Time"}
                        </Label>
                        <Input
                          id="time"
                          type="time"
                          required
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Success/Error Alerts */}
                  {message && (
                    <div className="flex items-center gap-2 text-xs font-semibold bg-green-50 text-green-700 p-2.5 rounded-lg border border-green-200">
                      <CheckCircle size={14} className="shrink-0" />
                      <span>{message}</span>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 text-xs font-semibold bg-red-50 text-red-700 p-2.5 rounded-lg border border-red-200">
                      <XCircle size={14} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSending}
                    className="w-full bg-[#4636D7] hover:bg-[#3b2dbb] text-white flex items-center justify-center gap-2 py-2.5"
                  >
                    {isSending ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Send size={16} />
                    )}
                    {isScheduled
                      ? (locale === "th" ? "บันทึกเวลาส่ง" : "Schedule Campaign")
                      : (locale === "th" ? "เริ่มส่งทันที" : "Send Now")}
                  </Button>
                </form>
              </Card>
            </div>

            {/* History Column */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-5 bg-white border border-[#DEDDE6]/60 shadow-sm rounded-xl h-full flex flex-col">
                <h2 className="text-lg font-semibold text-[#16182B] mb-4 flex items-center gap-2 shrink-0">
                  <FileText size={18} className="text-[#4f46e5]" />
                  {locale === "th" ? "ประวัติการส่งและแคมเปญตั้งเวลา" : "Campaign & Broadcast History"}
                  {selectedChannel && (
                    <Badge variant="muted" className="ml-2 font-normal">
                      {selectedChannel.name}
                    </Badge>
                  )}
                </h2>

                <div className="flex-1 overflow-x-auto min-h-[300px]">
                  {jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <Megaphone className="text-[#DEDDE6] mb-2" size={48} />
                      <p className="text-sm text-muted-foreground">
                        {locale === "th" ? "ไม่มีประวัติการส่งข้อมูลในช่องทางนี้" : "No broadcast history on this channel yet."}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#DEDDE6]/60 text-xs font-semibold text-[#767A8C] uppercase tracking-wider">
                          <th className="pb-3 pr-4">{locale === "th" ? "ประเภท" : "Type"}</th>
                          <th className="pb-3 px-4">{locale === "th" ? "ข้อความ / เนื้อหา" : "Content"}</th>
                          <th className="pb-3 px-4">{locale === "th" ? "สถานะ" : "Status"}</th>
                          <th className="pb-3 px-4">{locale === "th" ? "เป้าหมาย" : "Recipients"}</th>
                          <th className="pb-3 pl-4">{locale === "th" ? "กำหนดเวลาส่ง" : "Scheduled / Sent"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DEDDE6]/40 text-[#16182B]">
                        {jobs.map((job) => {
                          // Extract content info
                          let textSnippet = "";
                          let hasImage = false;

                          if (job.type === "BROADCAST") {
                            const msgs = Array.isArray(job.messages) ? job.messages : [];
                            const txtMsg = msgs.find((m: any) => m.type === "text");
                            const imgMsg = msgs.find((m: any) => m.type === "image");
                            textSnippet = txtMsg?.text || "";
                            hasImage = !!imgMsg;
                          } else {
                            const payload = job.messages as any;
                            const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
                            const txtMsg = msgs.find((m: any) => m.type === "text");
                            const imgMsg = msgs.find((m: any) => m.type === "image");
                            textSnippet = txtMsg?.text || "";
                            hasImage = !!imgMsg;
                          }

                          return (
                            <tr key={job.id} className="hover:bg-slate-50/50">
                              <td className="py-4 pr-4 align-top font-semibold">
                                <span className={job.type === "BROADCAST" ? "text-blue-600" : "text-purple-600"}>
                                  {job.type}
                                </span>
                              </td>
                              <td className="py-4 px-4 align-top max-w-[220px]">
                                <div className="space-y-1">
                                  {textSnippet && (
                                    <p className="line-clamp-2 text-xs text-muted-foreground font-normal">
                                      {textSnippet}
                                    </p>
                                  )}
                                  {hasImage && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4f46e5] bg-[#ECEBFF] px-2 py-0.5 rounded-full">
                                      <ImageIcon size={10} />
                                      {locale === "th" ? "มีรูปภาพ" : "Has image"}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 align-top">
                                <div className="space-y-1">
                                  {job.status === "SENT" && (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 font-semibold border-none">
                                      {locale === "th" ? "ส่งแล้ว" : "Sent"}
                                    </Badge>
                                  )}
                                  {job.status === "PENDING" && (
                                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 font-semibold border-none">
                                      {locale === "th" ? "รอคิว" : "Pending"}
                                    </Badge>
                                  )}
                                  {job.status === "PROCESSING" && (
                                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-semibold border-none">
                                      {locale === "th" ? "กำลังส่ง" : "Processing"}
                                    </Badge>
                                  )}
                                  {job.status === "FAILED" && (
                                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 font-semibold border-none">
                                      {locale === "th" ? "ล้มเหลว" : "Failed"}
                                    </Badge>
                                  )}
                                  {job.errorMessage && (
                                    <p className="text-[10px] text-red-600 line-clamp-1 max-w-[150px]" title={job.errorMessage}>
                                      {job.errorMessage}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 align-top text-xs font-semibold">
                                {job.type === "BROADCAST" ? (
                                  <span className="text-muted-foreground">{locale === "th" ? "ทุกคน" : "All followers"}</span>
                                ) : (
                                  <span>{job.recipientCount || 0} คน</span>
                                )}
                              </td>
                              <td className="py-4 pl-4 align-top text-xs text-muted-foreground whitespace-nowrap">
                                <div className="space-y-0.5">
                                  {job.status === "SENT" ? (
                                    <>
                                      <span className="font-semibold text-foreground">{locale === "th" ? "ส่งเมื่อ:" : "Sent at:"}</span>
                                      <p>{new Date(job.sentAt || job.createdAt).toLocaleString(locale === "th" ? "th-TH" : "en-US")}</p>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-semibold text-foreground">
                                        {job.scheduledAt ? (locale === "th" ? "ตั้งเวลาส่ง:" : "Scheduled:") : (locale === "th" ? "สร้างเมื่อ:" : "Created:")}
                                      </span>
                                      <p>
                                        {new Date(job.scheduledAt || job.createdAt).toLocaleString(locale === "th" ? "th-TH" : "en-US")}
                                      </p>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
