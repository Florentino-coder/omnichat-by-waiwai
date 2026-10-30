export type ConnectOrder = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number | null;
  currency: string | null;
  createdAt: string | null;
  items: Array<{ name: string; quantity: number | null }>;
};

export type ConnectDeposit = {
  reference: string;
  amount: number | null;
  currency: string | null;
  status: string;
  createdAt: string | null;
};

export type ConnectCustomer = {
  id: string;
  displayName: string;
  phoneMasked: string;
  emailMasked: string;
  recentOrders: ConnectOrder[];
  recentDeposits: ConnectDeposit[];
};

const MAX_CUSTOMERS = 5;
const MAX_RECENT = 10;
const MAX_ITEMS = 20;
const MAX_TEXT = 200;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asList = (value: unknown, max: number): unknown[] =>
  Array.isArray(value) ? value.slice(0, max) : [];

const asText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).slice(0, MAX_TEXT)
    : "";

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asDate = (value: unknown): string | null => {
  const text = asText(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
};

// Merchant responses are untrusted. Only documented fields are kept, so anything
// extra a merchant returns by mistake is never stored, shown, or passed on.
export function parseConnectOrder(value: unknown): ConnectOrder {
  const order = asRecord(value);
  return {
    orderNumber: asText(order.orderNumber),
    status: asText(order.status),
    paymentStatus: asText(order.paymentStatus),
    total: asNumber(order.total),
    currency: asText(order.currency) || null,
    createdAt: asDate(order.createdAt),
    items: asList(order.items, MAX_ITEMS).map((entry) => {
      const item = asRecord(entry);
      return { name: asText(item.name), quantity: asNumber(item.quantity) };
    })
  };
}

function parseConnectDeposit(value: unknown): ConnectDeposit {
  const deposit = asRecord(value);
  return {
    reference: asText(deposit.reference),
    amount: asNumber(deposit.amount),
    currency: asText(deposit.currency) || null,
    status: asText(deposit.status),
    createdAt: asDate(deposit.createdAt)
  };
}

export function parseConnectCustomer(value: unknown): ConnectCustomer {
  const customer = asRecord(value);
  return {
    id: asText(customer.id),
    displayName: asText(customer.displayName),
    phoneMasked: asText(customer.phoneMasked),
    emailMasked: asText(customer.emailMasked),
    recentOrders: asList(customer.recentOrders, MAX_RECENT).map(parseConnectOrder),
    recentDeposits: asList(customer.recentDeposits, MAX_RECENT).map(parseConnectDeposit)
  };
}

export function parseConnectCustomers(data: unknown): ConnectCustomer[] {
  return asList(asRecord(data).customers, MAX_CUSTOMERS).map(parseConnectCustomer);
}

export function parseConnectOrderDetail(data: unknown): {
  order: ConnectOrder;
  customer: ConnectCustomer | null;
} {
  const detail = asRecord(data);
  return {
    order: parseConnectOrder(detail.order),
    customer: detail.customer ? parseConnectCustomer(detail.customer) : null
  };
}
