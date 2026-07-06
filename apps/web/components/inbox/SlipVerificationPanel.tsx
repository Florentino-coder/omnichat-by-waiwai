import React from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import type { SlipVerification } from "../../app/app/inbox/hooks/useSlipVerifications";

interface SlipVerificationPanelProps {
  slips: SlipVerification[];
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function SlipVerificationPanel({
  slips,
  isLoading,
  isExpanded,
  onToggle,
}: SlipVerificationPanelProps) {
  // Count slips with PENDING or MANUAL_REVIEW status
  const pendingCount = slips.filter(
    (s) => s.verifyStatus === "PENDING" || s.verifyStatus === "MANUAL_REVIEW"
  ).length;

  if (slips.length === 0 && !isLoading) {
    return null; // hide section if no slips
  }

  return (
    <section className="border-b border-border px-6">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-4 text-left font-heading font-semibold text-[#6B6D7A] hover:text-foreground transition-colors"
        type="button"
      >
        <span className="flex items-center gap-2 text-base">
          <CheckCircle2 size={17} className="text-emerald-500" aria-hidden="true" />
          <span>ยืนยันสลิป</span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white leading-none">
              {pendingCount}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform duration-200 ${
            isExpanded ? "transform rotate-0" : "transform -rotate-90"
          }`}
        />
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[1000px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
        }`}
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <div className="space-y-4">
            {slips.map((slip) => {
              // Format date nicely
              let formattedDate = "ไม่ระบุ";
              if (slip.transferDate) {
                try {
                  const d = new Date(slip.transferDate);
                  if (!isNaN(d.getTime())) {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  }
                } catch (_) {}
              }

              // Status badges and colors
              let statusLabelText = slip.verifyStatus;
              let badgeColorClass = "border-slate-300 bg-slate-50 text-slate-700";
              if (slip.verifyStatus === "VERIFIED") {
                statusLabelText = "VERIFIED / สลิปถูกต้อง";
                badgeColorClass = "border-emerald-300 bg-emerald-50 text-emerald-800";
              } else if (slip.verifyStatus === "INVALID") {
                statusLabelText = "INVALID / สลิปไม่ถูกต้อง";
                badgeColorClass = "border-red-300 bg-red-50 text-red-800";
              } else if (slip.verifyStatus === "DUPLICATE") {
                statusLabelText = "DUPLICATE / สลิปซ้ำ";
                badgeColorClass = "border-amber-300 bg-amber-50 text-amber-800";
              } else if (slip.verifyStatus === "MANUAL_REVIEW") {
                statusLabelText = "MANUAL_REVIEW / ตรวจสอบด้วยมือ (โควตาหมด)";
                badgeColorClass = "border-amber-300 bg-amber-50 text-amber-800";
              }

              // Parse provider status detail
              let detailStr = "ตรวจสอบความถูกต้องเรียบร้อย";
              if (slip.verifyStatus === "INVALID") {
                detailStr = "สลิปไม่ถูกต้อง (ข้อมูลไม่ตรงกับธนาคารหรือสลิปปลอม)";
              } else if (slip.verifyStatus === "DUPLICATE") {
                detailStr = "สลิปซ้ำซ้อน (สลิปนี้เคยใช้ยืนยันไปแล้ว)";
              } else if (slip.verifyStatus === "MANUAL_REVIEW") {
                detailStr = "ระบบขัดข้องหรือโควตาหมด กรุณาตรวจสอบด้วยตนเอง";
              } else if (slip.verifyStatus === "PENDING") {
                detailStr = "กำลังดำเนินการตรวจสอบ";
              }

              return (
                <div key={slip.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm text-foreground space-y-2">
                  <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2">
                    <span className="font-semibold text-slate-800">
                      🧾 ตรวจพบรูปภาพสลิปโอนเงิน
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      คะแนนความมั่นใจ: {slip.slipScore}%
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <div>• ธนาคาร: <span className="font-semibold">{slip.bankName || "ไม่ระบุ"}</span></div>
                    <div>• ยอดโอน: <span className="font-semibold text-slate-800">{slip.amount ? Number(slip.amount).toFixed(2) : "ไม่ระบุ"} บาท</span></div>
                    <div>• เลขที่อ้างอิง: <span className="font-mono text-xs">{slip.transactionRef || "ไม่ระบุ"}</span></div>
                    <div>• วันโอน: <span>{formattedDate}</span></div>
                  </div>
                  <div className="border-t border-dashed border-slate-200 pt-2 space-y-1">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      [ผลการทวนสอบสลิป (QR & SlipOK)]
                    </div>
                    <div>• สถานะ QR: <span className={`font-semibold ${slip.qrDecodeStatus === "SUCCESS" ? "text-emerald-600" : "text-red-500"}`}>{slip.qrDecodeStatus}</span></div>
                    <div>• ผู้ให้บริการ: <span>{slip.verifyProvider || "-"}</span></div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>• สถานะการทวนสอบ:</span>
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${badgeColorClass}`}>
                        {statusLabelText}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">• รายละเอียด: {detailStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
