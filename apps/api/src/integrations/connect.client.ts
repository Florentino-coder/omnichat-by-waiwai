import { HttpException, HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { buildConnectHeaders } from "./connect-signature.util";
import {
  ConnectCustomer,
  ConnectOrder,
  parseConnectCustomers,
  parseConnectOrderDetail
} from "./connect-response.util";
import { ConnectTransport, ConnectTransportResponse } from "./connect-transport";

export const CONNECT_TRANSPORT = "CONNECT_TRANSPORT";

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const API_VERSION_PATH = "/v1";

export type ConnectTarget = {
  baseUrl: string;
  keyId: string;
  secrets: string[];
};

const fail = (code: string, message: string, status: HttpStatus): HttpException =>
  new HttpException({ success: false, error: { code, message } }, status);

@Injectable()
export class ConnectClient {
  private readonly logger = new Logger(ConnectClient.name);

  constructor(@Inject(CONNECT_TRANSPORT) private readonly transport: ConnectTransport) {}

  async health(target: ConnectTarget): Promise<void> {
    await this.request(target, "/health");
  }

  /** True when the merchant refuses a bad signature, as the spec requires. */
  async rejectsBadSignature(target: ConnectTarget): Promise<boolean> {
    const response = await this.send(
      { ...target, secrets: ["chatwai-connect-signature-check"] },
      "/health"
    );
    return response.status === 401 || response.status === 403;
  }

  async lookupCustomers(target: ConnectTarget, phone: string): Promise<ConnectCustomer[]> {
    return parseConnectCustomers(
      await this.request(target, `/customers/lookup?phone=${encodeURIComponent(phone)}`)
    );
  }

  async getOrder(
    target: ConnectTarget,
    orderNumber: string
  ): Promise<{ order: ConnectOrder; customer: ConnectCustomer | null }> {
    return parseConnectOrderDetail(
      await this.request(target, `/orders/${encodeURIComponent(orderNumber)}`)
    );
  }

  private async send(target: ConnectTarget, path: string): Promise<ConnectTransportResponse> {
    const url = new URL(`${target.baseUrl}${API_VERSION_PATH}${path}`);
    try {
      return await this.transport({
        url,
        headers: {
          ...buildConnectHeaders(target.keyId, target.secrets, url),
          Accept: "application/json"
        },
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxBytes: MAX_RESPONSE_BYTES
      });
    } catch (error) {
      this.logger.warn(
        `Connect request failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw fail(
        "CONNECT_UNAVAILABLE",
        "Could not reach the connected system. Try again.",
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  private async request(target: ConnectTarget, path: string): Promise<unknown> {
    const { status, body } = await this.send(target, path);

    if (status === 401 || status === 403) {
      throw fail(
        "CONNECT_KEY_REJECTED",
        "The connected system rejected the signature. Check its secret.",
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
    if (status === 404) {
      throw fail("CONNECT_NOT_FOUND", "Not found in the connected system.", HttpStatus.NOT_FOUND);
    }
    if (status === 400) {
      throw fail(
        "CONNECT_BAD_REQUEST",
        "The connected system rejected this search.",
        HttpStatus.BAD_REQUEST
      );
    }
    if (status === 429) {
      throw fail(
        "CONNECT_RATE_LIMITED",
        "Too many lookups. Try again shortly.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if (status < 200 || status >= 300) {
      this.logger.warn(`Connected system responded with status ${status}`);
      throw fail(
        "CONNECT_UNAVAILABLE",
        "Could not reach the connected system. Try again.",
        HttpStatus.BAD_GATEWAY
      );
    }

    try {
      return (JSON.parse(body) as { data?: unknown }).data;
    } catch {
      throw fail(
        "CONNECT_INVALID_RESPONSE",
        "The connected system returned an invalid response.",
        HttpStatus.BAD_GATEWAY
      );
    }
  }
}
