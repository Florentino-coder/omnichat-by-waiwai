import { LineWebhookProcessorService } from "./line-webhook-processor.service";
import { LineWebhookService } from "./line-webhook.service";

describe("LineWebhookProcessorService", () => {
  it("processes BullMQ LINE webhook jobs through LineWebhookService", async () => {
    const lineWebhookService = {
      process: jest.fn<Promise<void>, [string, { events?: [] }]>().mockResolvedValue(undefined)
    };
    const processor = new LineWebhookProcessorService(lineWebhookService as unknown as LineWebhookService);

    await processor.processJob({
      data: {
        lineChannelId: "line-channel-1",
        payload: { events: [] }
      }
    });

    expect(lineWebhookService.process).toHaveBeenCalledWith("line-channel-1", { events: [] });
  });
});
