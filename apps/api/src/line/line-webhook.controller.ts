import { Body, Controller, Headers, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { LineSignatureService } from "./line-signature.service";
import { LineWebhookQueueService } from "./line-webhook-queue.service";
import { LineWebhookService } from "./line-webhook.service";
import { MonitorService } from "../monitor/monitor.service";
import * as crypto from "crypto";

type RawBodyRequest = {
  rawBody?: Buffer;
};

@Controller("line/webhook")
export class LineWebhookController {
  constructor(
    private readonly lineSignatureService: LineSignatureService,
    private readonly lineWebhookService: LineWebhookService,
    private readonly lineWebhookQueueService: LineWebhookQueueService,
    private readonly monitorService: MonitorService
  ) {}

  @Post(":lineChannelId")
  async receive(
    @Param("lineChannelId") lineChannelId: string,
    @Headers("x-line-signature") signature: string | undefined,
    @Body() body: unknown,
    @Req() request: RawBodyRequest
  ): Promise<{ accepted: true }> {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(body));
    const channelSecret = await this.lineWebhookService.getChannelSecret(lineChannelId);
    if (!this.lineSignatureService.verify(rawBody, signature, channelSecret)) {
      throw new UnauthorizedException("Invalid LINE signature");
    }

    const flowId = `flow_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    await this.monitorService.recordEvent(flowId, "WEBHOOK_RECEIVED");

    await this.lineWebhookQueueService.enqueue(lineChannelId, body, flowId);
    return { accepted: true };
  }
}

