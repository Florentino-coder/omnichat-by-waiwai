import { LineWebhookProcessorService } from "./line-webhook-processor.service";
import { LineWebhookService } from "./line-webhook.service";
import { Worker } from "bullmq";

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn<Promise<void>, []>().mockResolvedValue(undefined)
  }))
}));

describe("LineWebhookProcessorService", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalQueueMode = process.env.LINE_WEBHOOK_QUEUE_MODE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalQueueMode === undefined) {
      delete process.env.LINE_WEBHOOK_QUEUE_MODE;
    } else {
      process.env.LINE_WEBHOOK_QUEUE_MODE = originalQueueMode;
    }
    jest.clearAllMocks();
  });

  it("does not start the BullMQ worker unless LINE_WEBHOOK_QUEUE_MODE is bullmq", () => {
    process.env.NODE_ENV = "production";
    delete process.env.LINE_WEBHOOK_QUEUE_MODE;
    const lineWebhookService = {
      process: jest.fn<Promise<void>, [string, { events?: [] }]>().mockResolvedValue(undefined)
    };
    const configService = {
      get: jest.fn<string | undefined, [string]>().mockReturnValue("redis://redis.example.test:6379")
    };
    const processor = new LineWebhookProcessorService(
      lineWebhookService as unknown as LineWebhookService,
      configService as never
    );

    processor.onModuleInit();

    expect(Worker).not.toHaveBeenCalled();
  });

  it("starts the BullMQ worker when LINE_WEBHOOK_QUEUE_MODE is bullmq", () => {
    process.env.NODE_ENV = "production";
    process.env.LINE_WEBHOOK_QUEUE_MODE = "bullmq";
    const lineWebhookService = {
      process: jest.fn<Promise<void>, [string, { events?: [] }]>().mockResolvedValue(undefined)
    };
    const configService = {
      get: jest.fn<string | undefined, [string]>().mockReturnValue("redis://redis.example.test:6379")
    };
    const processor = new LineWebhookProcessorService(
      lineWebhookService as unknown as LineWebhookService,
      configService as never
    );

    processor.onModuleInit();

    expect(Worker).toHaveBeenCalledWith(
      "line-webhooks",
      expect.any(Function),
      expect.objectContaining({
        connection: { url: "redis://redis.example.test:6379" },
        concurrency: 5
      })
    );
  });

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

    expect(lineWebhookService.process).toHaveBeenCalledWith("line-channel-1", { events: [] }, undefined);
  });
});
