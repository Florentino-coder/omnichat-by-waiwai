"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch, authorizedFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";

type Connection = {
  id: string;
  name: string;
  baseUrl: string;
  keyId: string;
  lastTestedAt: string | null;
  lastTestOk: boolean;
  previousSecretExpiresAt: string | null;
  suspendedAt: string | null;
};

type TestResult = {
  ok: boolean;
  signatureEnforced: boolean;
  errorCode: string | null;
};

const API_PATH = "/api/v1/integrations/connection";

const COPY = {
  th: {
    title: "ChatWai Connect",
    subtitle:
      "เชื่อมระบบร้านค้าของคุณ เพื่อให้เจ้าหน้าที่ค้นออเดอร์และรายการฝากจากหน้าแชทได้ ระบบอ่านข้อมูลอย่างเดียว",
    name: "ชื่อระบบ",
    baseUrl: "URL ของระบบ",
    baseUrlHint: "ต้องเป็น https ระบบต้องมี endpoint ตาม ChatWai Connect v1",
    create: "สร้าง key",
    saving: "กำลังทำรายการ...",
    secretTitle: "คัดลอก secret ตอนนี้ ระบบจะไม่แสดงอีก",
    secretHint: "นำ Key ID และ Secret ไปตั้งค่าในระบบร้านค้า แล้วกดทดสอบการเชื่อมต่อ",
    copy: "คัดลอก",
    copied: "คัดลอกแล้ว",
    keyId: "Key ID",
    secret: "Secret",
    suspended: "การเชื่อมต่อนี้ถูกระงับโดยผู้ดูแลระบบ กรุณาติดต่อฝ่ายสนับสนุน",
    verified: "ทดสอบผ่านแล้ว เจ้าหน้าที่ค้นข้อมูลจากหน้าแชทได้",
    unverified: "ยังไม่ผ่านการทดสอบ เจ้าหน้าที่ยังค้นข้อมูลไม่ได้",
    test: "ทดสอบการเชื่อมต่อ",
    rotate: "เปลี่ยน secret",
    rotateConfirm: "สร้าง secret ใหม่? secret เก่ายังใช้ได้อีก 24 ชั่วโมง",
    rotateNotice: (date: string) => `secret เก่าใช้ได้ถึง ${date}`,
    disconnect: "ยกเลิกการเชื่อมต่อ",
    disconnectConfirm: "ยกเลิกการเชื่อมต่อ? เจ้าหน้าที่จะค้นข้อมูลจากหน้าแชทไม่ได้ และ key นี้จะใช้ไม่ได้อีก",
    testErrors: {
      CONNECT_SIGNATURE_NOT_ENFORCED:
        "ระบบของคุณยอมรับลายเซ็นที่ผิด ต้องตรวจลายเซ็นก่อน มิฉะนั้นใครก็ดึงข้อมูลลูกค้าได้",
      CONNECT_KEY_REJECTED: "ระบบของคุณปฏิเสธลายเซ็น ตรวจสอบ Key ID และ Secret",
      CONNECT_NOT_FOUND: "ไม่พบ endpoint /v1/health ตรวจสอบ URL ของระบบ",
      CONNECT_INVALID_RESPONSE: "ระบบตอบกลับไม่ตรงรูปแบบ JSON ของ spec"
    } as Record<string, string>,
    testFallback: "เชื่อมต่อระบบไม่ได้ ตรวจสอบ URL และลองอีกครั้ง",
    requestFailed: "ทำรายการไม่สำเร็จ ลองอีกครั้ง"
  },
  en: {
    title: "ChatWai Connect",
    subtitle:
      "Connect your store system so agents can look up orders and deposits from the inbox. Access is read-only.",
    name: "System name",
    baseUrl: "System URL",
    baseUrlHint: "Must use https. Your system must implement ChatWai Connect v1.",
    create: "Generate key",
    saving: "Working...",
    secretTitle: "Copy the secret now. It will not be shown again.",
    secretHint: "Add the Key ID and Secret to your store system, then test the connection.",
    copy: "Copy",
    copied: "Copied",
    keyId: "Key ID",
    secret: "Secret",
    suspended: "This connection was suspended by the platform administrator. Please contact support.",
    verified: "Test passed. Agents can look up data from the inbox.",
    unverified: "Not tested yet. Agents cannot look up data until the test passes.",
    test: "Test connection",
    rotate: "Rotate secret",
    rotateConfirm: "Generate a new secret? The old one keeps working for 24 hours.",
    rotateNotice: (date: string) => `The old secret works until ${date}`,
    disconnect: "Disconnect",
    disconnectConfirm: "Disconnect? Agents will lose inbox lookups and this key will stop working.",
    testErrors: {
      CONNECT_SIGNATURE_NOT_ENFORCED:
        "Your system accepted an invalid signature. It must verify signatures, or anyone could read customer data.",
      CONNECT_KEY_REJECTED: "Your system rejected the signature. Check the Key ID and Secret.",
      CONNECT_NOT_FOUND: "Could not find /v1/health. Check the system URL.",
      CONNECT_INVALID_RESPONSE: "Your system did not return JSON in the format the spec requires."
    } as Record<string, string>,
    testFallback: "Could not reach your system. Check the URL and try again.",
    requestFailed: "Request failed. Try again."
  }
};

export function ConnectSettings() {
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Connection | null>(API_PATH)
      .then((result) => {
        if (!cancelled) setConnection(result);
      })
      .catch(() => {
        if (!cancelled) setError(copy.requestFailed);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.requestFailed]);

  async function run(action: () => Promise<void>): Promise<void> {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.requestFailed);
    } finally {
      setIsBusy(false);
    }
  }

  function showSecret(result: Connection & { secret: string }): void {
    const { secret: newSecret, ...view } = result;
    setConnection(view);
    setSecret(newSecret);
    setIsCopied(false);
    setTestResult(null);
  }

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(async () => {
      showSecret(
        await apiFetch<Connection & { secret: string }>(API_PATH, {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), baseUrl: baseUrl.trim() })
        })
      );
      setName("");
      setBaseUrl("");
    });
  }

  function onTest(): void {
    void run(async () => {
      const result = await apiFetch<TestResult>(`${API_PATH}/test`, { method: "POST" });
      setTestResult(result);
      setConnection((current) => (current ? { ...current, lastTestOk: result.ok } : current));
    });
  }

  function onRotate(): void {
    if (!window.confirm(copy.rotateConfirm)) {
      return;
    }
    void run(async () => {
      showSecret(
        await apiFetch<Connection & { secret: string }>(`${API_PATH}/rotate`, { method: "POST" })
      );
    });
  }

  function onDisconnect(): void {
    if (!window.confirm(copy.disconnectConfirm)) {
      return;
    }
    void run(async () => {
      const response = await authorizedFetch(API_PATH, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(copy.requestFailed);
      }
      setConnection(null);
      setSecret(null);
      setTestResult(null);
    });
  }

  async function onCopySecret(): Promise<void> {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setIsCopied(true);
    }
  }

  const errorBanner = error ? (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <div className="space-y-5">
      <div className="border-b border-[#DEDDE6]/60 pb-4">
        <h2 className="font-heading text-lg font-semibold text-[#16182B]">{copy.title}</h2>
        <p className="mt-1 text-sm text-[#767A8C]">{copy.subtitle}</p>
      </div>

      {!isLoaded ? null : connection ? (
        <div className="max-w-2xl space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-[120px_1fr]">
            <dt className="text-[#767A8C]">{copy.name}</dt>
            <dd className="font-medium break-words">{connection.name}</dd>
            <dt className="text-[#767A8C]">{copy.baseUrl}</dt>
            <dd className="font-mono text-xs break-all">{connection.baseUrl}</dd>
            <dt className="text-[#767A8C]">{copy.keyId}</dt>
            <dd className="font-mono text-xs break-all">{connection.keyId}</dd>
          </dl>

          {secret ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="connect-secret">
              <p className="text-sm font-semibold text-amber-900">{copy.secretTitle}</p>
              <p className="font-mono text-xs break-all text-amber-900">{secret}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => void onCopySecret()}>
                  {isCopied ? copy.copied : copy.copy}
                </Button>
                <p className="text-xs text-amber-800">{copy.secretHint}</p>
              </div>
            </div>
          ) : null}

          {connection.suspendedAt ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {copy.suspended}
            </p>
          ) : null}

          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              connection.lastTestOk ? "bg-emerald-50 text-emerald-800" : "bg-[#F6F5FA] text-[#60636F]"
            }`}
            role="status"
          >
            {connection.lastTestOk ? copy.verified : copy.unverified}
          </p>

          {testResult && !testResult.ok ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {copy.testErrors[testResult.errorCode ?? ""] ?? copy.testFallback}
            </p>
          ) : null}

          {connection.previousSecretExpiresAt ? (
            <p className="text-xs text-[#767A8C]">
              {copy.rotateNotice(new Date(connection.previousSecretExpiresAt).toLocaleString())}
            </p>
          ) : null}

          {errorBanner}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={isBusy || Boolean(connection.suspendedAt)} onClick={onTest}>
              {isBusy ? copy.saving : copy.test}
            </Button>
            <Button type="button" variant="secondary" disabled={isBusy} onClick={onRotate}>
              {copy.rotate}
            </Button>
            <Button type="button" variant="ghost" disabled={isBusy} onClick={onDisconnect}>
              {copy.disconnect}
            </Button>
          </div>
        </div>
      ) : (
        <form className="max-w-lg space-y-3" onSubmit={onCreate}>
          <div className="space-y-2">
            <Label htmlFor="connect-name">{copy.name}</Label>
            <Input id="connect-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="connect-base-url">{copy.baseUrl}</Label>
            <Input
              id="connect-base-url"
              type="url"
              placeholder="https://api.example.com/chatwai"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
            <p className="text-xs text-[#767A8C]">{copy.baseUrlHint}</p>
          </div>
          {errorBanner}
          <Button type="submit" disabled={isBusy || !name.trim() || !baseUrl.trim()}>
            {isBusy ? copy.saving : copy.create}
          </Button>
        </form>
      )}
    </div>
  );
}
