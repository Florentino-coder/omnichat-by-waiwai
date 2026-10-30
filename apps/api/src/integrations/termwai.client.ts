import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const DEFAULT_BASE_URL = "https://api.termwai.in.th";
const API_PATH = "/api/integrations/chat";
const REQUEST_TIMEOUT_MS = 8000;

export type TermwaiOrder = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  total: number;
  createdAt: string;
  items: Array<{ productName: string; quantity: number }>;
};

export type TermwaiDeposit = {
  reference: string;
  amount: number;
  currency?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
};

export type TermwaiCustomer = {
  id: string;
  username: string;
  phoneMasked: string;
  emailMasked: string;
  isActive?: boolean;
  createdAt?: string;
};

export type TermwaiCustomerDetail = TermwaiCustomer & {
  recentOrders: TermwaiOrder[];
  recentDeposits: TermwaiDeposit[];
};

export type TermwaiOrderDetail = {
  order: TermwaiOrder;
  customer: TermwaiCustomer | null;
};

const fail = (code: string, message: string, status: HttpStatus): HttpException =>
  new HttpException({ success: false, error: { code, message } }, status);

@Injectable()
export class TermwaiClient {
  private readonly logger = new Logger(TermwaiClient.name);

  constructor(private readonly configService: ConfigService) {}

  async ping(apiKey: string): Promise<void> {
    await this.request<unknown>(apiKey, "/ping");
  }

  async lookupCustomers(apiKey: string, phone: string): Promise<TermwaiCustomerDetail[]> {
    const data = await this.request<{ customers: TermwaiCustomerDetail[] }>(
      apiKey,
      `/customers/lookup?phone=${encodeURIComponent(phone)}`
    );
    return data.customers;
  }

  getOrder(apiKey: string, orderNumber: string): Promise<TermwaiOrderDetail> {
    return this.request<TermwaiOrderDetail>(
      apiKey,
      `/orders/${encodeURIComponent(orderNumber)}`
    );
  }

  private async request<T>(apiKey: string, path: string): Promise<T> {
    const baseUrl = (
      this.configService.get<string>("TERMWAI_API_BASE_URL") || DEFAULT_BASE_URL
    ).replace(/\/+$/, "");

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${API_PATH}${path}`, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
    } catch (error) {
      this.logger.warn(
        `Termwai request failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw fail(
        "TERMWAI_UNAVAILABLE",
        "Could not reach Termwai. Try again.",
        HttpStatus.BAD_GATEWAY
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw fail(
        "TERMWAI_KEY_REJECTED",
        "Termwai rejected the API key.",
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
    if (response.status === 404) {
      throw fail("TERMWAI_NOT_FOUND", "Not found in Termwai.", HttpStatus.NOT_FOUND);
    }
    if (response.status === 400) {
      throw fail("TERMWAI_BAD_REQUEST", "Termwai rejected this search.", HttpStatus.BAD_REQUEST);
    }
    if (response.status === 429) {
      throw fail(
        "TERMWAI_RATE_LIMITED",
        "Too many Termwai lookups. Try again shortly.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if (!response.ok) {
      this.logger.warn(`Termwai responded with status ${response.status}`);
      throw fail(
        "TERMWAI_UNAVAILABLE",
        "Could not reach Termwai. Try again.",
        HttpStatus.BAD_GATEWAY
      );
    }

    const body = (await response.json().catch(() => null)) as { data?: T } | null;
    return (body?.data ?? body) as T;
  }
}
