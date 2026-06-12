import { Injectable } from "@nestjs/common";
import { LineWebhookService } from "./line-webhook.service";

@Injectable()
export class LineWebhookQueueService {
  constructor(private readonly lineWebhookService: LineWebhookService) {}

  async enqueue(lineChannelId: string, payload: unknown): Promise<void> {
    await this.lineWebhookService.process(lineChannelId, payload as { events?: [] });
  }
}

