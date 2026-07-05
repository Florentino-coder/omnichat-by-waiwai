import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SlipOkResponse {
  status: "valid" | "invalid" | "duplicate" | "error";
  data?: any;
  message?: string;
}

@Injectable()
export class SlipOkClient {
  private readonly logger = new Logger(SlipOkClient.name);
  private readonly apiKey: string;
  private readonly branchId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("SLIPOK_API_KEY") || "";
    this.branchId = this.configService.get<string>("SLIPOK_BRANCH_ID") || "";
  }

  async verifyQr(qrRawData: string): Promise<SlipOkResponse> {
    if (!this.apiKey || !this.branchId) {
      this.logger.error("SLIPOK_API_KEY or SLIPOK_BRANCH_ID is not configured");
      return { status: "error", message: "SlipOK credentials missing" };
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    try {
      const url = `https://api.slipok.com/api/v2/partner/transfer/qrcode/${this.branchId}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-authorization": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: qrRawData,
          log: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(id);

      const body = await response.json() as any;

      if (response.ok && body.success === true) {
        return {
          status: "valid",
          data: body.data,
        };
      }

      const errMsg = body.message || "";
      const errCode = String(body.code || "");
      const isDuplicate =
        errMsg.toUpperCase().includes("DUPLICATE") ||
        errMsg.toUpperCase().includes("ALREADY") ||
        errCode.toUpperCase().includes("DUPLICATE");

      if (isDuplicate) {
        return {
          status: "duplicate",
          message: errMsg,
          data: body.data,
        };
      }

      return {
        status: "invalid",
        message: errMsg,
        data: body.data,
      };
    } catch (error: any) {
      clearTimeout(id);
      this.logger.error(`SlipOK request failed: ${error.message}`);
      return {
        status: "error",
        message: error.name === "AbortError" ? "Request timeout" : error.message,
      };
    }
  }
}
