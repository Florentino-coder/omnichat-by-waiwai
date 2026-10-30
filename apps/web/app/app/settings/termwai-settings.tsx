"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch, authorizedFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";

type TermwaiStatus = {
  connected: boolean;
  keyLast4: string | null;
  updatedAt: string | null;
};

const COPY = {
  th: {
    title: "เชื่อมต่อ Termwai",
    subtitle: "ให้เจ้าหน้าที่ค้นออเดอร์และรายการฝากของลูกค้าจากหน้าแชทได้ ระบบอ่านข้อมูลอย่างเดียว",
    keyLabel: "API key",
    keyHint: "ใช้ key ที่ขึ้นต้นด้วย twchat_ ระบบจะเข้ารหัสก่อนเก็บ และจะไม่แสดง key เต็มอีก",
    connect: "เชื่อมต่อ",
    connecting: "กำลังตรวจสอบ key...",
    replace: "เปลี่ยน key",
    connected: (last4: string) => `เชื่อมต่อแล้ว (key ลงท้าย ${last4})`,
    disconnect: "ยกเลิกการเชื่อมต่อ",
    disconnectConfirm: "ยกเลิกการเชื่อมต่อ Termwai? เจ้าหน้าที่จะค้นข้อมูลจากหน้าแชทไม่ได้",
    loadError: "โหลดสถานะการเชื่อมต่อไม่สำเร็จ",
    saveError: "เชื่อมต่อไม่สำเร็จ"
  },
  en: {
    title: "Termwai connection",
    subtitle: "Lets agents look up customer orders and deposits from the inbox. Access is read-only.",
    keyLabel: "API key",
    keyHint: "Use a key starting with twchat_. It is encrypted when saved and never shown in full again.",
    connect: "Connect",
    connecting: "Checking key...",
    replace: "Replace key",
    connected: (last4: string) => `Connected (key ending ${last4})`,
    disconnect: "Disconnect",
    disconnectConfirm: "Disconnect Termwai? Agents will not be able to look up data from the inbox.",
    loadError: "Could not load the connection status.",
    saveError: "Could not connect."
  }
};

export function TermwaiSettings() {
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [status, setStatus] = useState<TermwaiStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TermwaiStatus>("/api/v1/integrations/termwai")
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) setError(copy.loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.loadError]);

  async function onConnect(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiFetch<TermwaiStatus>("/api/v1/integrations/termwai", {
        method: "POST",
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      setStatus(result);
      setApiKey("");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : copy.saveError);
    } finally {
      setIsBusy(false);
    }
  }

  async function onDisconnect(): Promise<void> {
    if (!window.confirm(copy.disconnectConfirm)) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const response = await authorizedFetch("/api/v1/integrations/termwai", { method: "DELETE" });
      if (!response.ok) {
        throw new Error(copy.saveError);
      }
      setStatus({ connected: false, keyLast4: null, updatedAt: null });
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : copy.saveError);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="border-b border-[#DEDDE6]/60 pb-4">
        <h2 className="font-heading text-lg font-semibold text-[#16182B]">{copy.title}</h2>
        <p className="mt-1 text-sm text-[#767A8C]">{copy.subtitle}</p>
      </div>

      {status?.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-800" role="status">
            {copy.connected(status.keyLast4 ?? "")}
          </p>
          <Button type="button" variant="secondary" disabled={isBusy} onClick={() => void onDisconnect()}>
            {copy.disconnect}
          </Button>
        </div>
      ) : null}

      <form className="max-w-lg space-y-3" onSubmit={(event) => void onConnect(event)}>
        <div className="space-y-2">
          <Label htmlFor="termwai-api-key">{copy.keyLabel}</Label>
          <Input
            id="termwai-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <p className="text-xs text-[#767A8C]">{copy.keyHint}</p>
        </div>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={isBusy || !apiKey.trim()}>
          {isBusy ? copy.connecting : status?.connected ? copy.replace : copy.connect}
        </Button>
      </form>
    </div>
  );
}
