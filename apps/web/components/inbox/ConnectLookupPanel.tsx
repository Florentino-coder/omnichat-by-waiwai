"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@omnichat/ui";
import { apiFetch } from "../../app/lib/api-client";
import { useLanguage } from "../../app/lib/language-context";

type ConnectOrder = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number | null;
  currency?: string | null;
  createdAt: string | null;
  items: Array<{ name: string; quantity: number | null }>;
};

type ConnectDeposit = {
  reference: string;
  amount: number | null;
  currency?: string | null;
  status: string;
  createdAt: string | null;
};

type ConnectCustomer = {
  id: string;
  displayName: string;
  phoneMasked: string;
  emailMasked: string;
  recentOrders?: ConnectOrder[];
  recentDeposits?: ConnectDeposit[];
};

const COPY = {
  th: {
    title: "ข้อมูลร้านค้า",
    placeholder: "เบอร์โทร หรือเลขออเดอร์",
    search: "ค้นหา",
    searching: "กำลังค้นหา...",
    empty: "ไม่พบข้อมูลในระบบร้านค้า",
    orders: "ออเดอร์ล่าสุด",
    deposits: "รายการฝากล่าสุด",
    noOrders: "ไม่มีออเดอร์",
    noDeposits: "ไม่มีรายการฝาก",
    warning: "เบอร์ที่ลูกค้าแจ้งอาจไม่ใช่ของลูกค้าจริง ตรวจสอบตัวตนก่อนบอกข้อมูล",
    error: "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง"
  },
  en: {
    title: "Store data",
    placeholder: "Phone or order number",
    search: "Search",
    searching: "Searching...",
    empty: "Nothing found in the store system",
    orders: "Recent orders",
    deposits: "Recent deposits",
    noOrders: "No orders",
    noDeposits: "No deposits",
    warning: "A phone number from chat may not be the customer's own. Verify identity before sharing details.",
    error: "Search failed. Try again."
  }
};

const isOrderNumber = (value: string): boolean => /[A-Za-z]/.test(value);

function formatAmount(value: number | null, currency?: string | null): string {
  if (value === null) {
    return "-";
  }
  const amount = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return !currency || currency === "THB" ? `฿${amount}` : `${amount} ${currency}`;
}

function formatDate(value: string | null): string {
  const date = new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function OrderRow({ order }: { order: ConnectOrder }) {
  return (
    <li className="rounded-lg border border-border px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2 font-medium">
        <span className="truncate">{order.orderNumber}</span>
        <span>{formatAmount(order.total, order.currency)}</span>
      </div>
      <p className="mt-0.5 truncate text-muted-foreground">
        {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ") || "-"}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        {order.status} · {order.paymentStatus} · {formatDate(order.createdAt)}
      </p>
    </li>
  );
}

export function ConnectLookupPanel({ phone, disabled }: { phone?: string | null; disabled?: boolean }) {
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [isConnected, setIsConnected] = useState(false);
  const [query, setQuery] = useState(phone ?? "");
  const [customers, setCustomers] = useState<ConnectCustomer[] | null>(null);
  const [order, setOrder] = useState<ConnectOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Hidden for roles without access and for tenants that have not connected.
    apiFetch<{ connected: boolean }>("/api/v1/integrations/status")
      .then((status) => {
        if (!cancelled) setIsConnected(status.connected);
      })
      .catch(() => {
        if (!cancelled) setIsConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setQuery(phone ?? "");
    setCustomers(null);
    setOrder(null);
    setError(null);
  }, [phone]);

  if (!isConnected) {
    return null;
  }

  async function onSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setCustomers(null);
    setOrder(null);
    try {
      if (isOrderNumber(value)) {
        const result = await apiFetch<{ order: ConnectOrder; customer: ConnectCustomer | null }>(
          `/api/v1/integrations/lookup/orders/${encodeURIComponent(value)}`
        );
        setOrder(result.order);
        setCustomers(result.customer ? [result.customer] : []);
      } else {
        setCustomers(
          await apiFetch<ConnectCustomer[]>(
            `/api/v1/integrations/lookup/customers?phone=${encodeURIComponent(value)}`
          )
        );
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : copy.error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="border-b border-border px-6 py-5" data-testid="connect-lookup-panel">
      <h4 className="mb-3 text-sm font-semibold">{copy.title}</h4>
      <form className="flex gap-2" onSubmit={(event) => void onSearch(event)}>
        <Input
          aria-label={copy.placeholder}
          placeholder={copy.placeholder}
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={disabled || isLoading || !query.trim()}>
          {isLoading ? copy.searching : copy.search}
        </Button>
      </form>

      {error ? (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {customers && customers.length === 0 && !order ? (
        <p className="mt-3 text-xs text-muted-foreground">{copy.empty}</p>
      ) : null}

      {order ? (
        <ul className="mt-3">
          <OrderRow order={order} />
        </ul>
      ) : null}

      {customers && customers.length > 0 ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-amber-700">{copy.warning}</p>
          {customers.map((customer) => (
            <div key={customer.id} className="space-y-2">
              <p className="text-sm font-medium">{customer.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {customer.phoneMasked} · {customer.emailMasked}
              </p>

              {customer.recentOrders ? (
                <div>
                  <p className="mb-1 text-xs font-semibold">{copy.orders}</p>
                  {customer.recentOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{copy.noOrders}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {customer.recentOrders.map((item) => (
                        <OrderRow key={item.orderNumber} order={item} />
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {customer.recentDeposits ? (
                <div>
                  <p className="mb-1 text-xs font-semibold">{copy.deposits}</p>
                  {customer.recentDeposits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{copy.noDeposits}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {customer.recentDeposits.map((deposit) => (
                        <li key={deposit.reference} className="rounded-lg border border-border px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2 font-medium">
                            <span>{formatAmount(deposit.amount, deposit.currency)}</span>
                            <span>{deposit.status}</span>
                          </div>
                          <p className="mt-0.5 text-muted-foreground">
                            {deposit.reference} · {formatDate(deposit.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
