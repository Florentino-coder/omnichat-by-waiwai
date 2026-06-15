import { LineWebhookQueueService, type WebhookQueuePort } from "./line-webhook-queue.service";

const createQueue = (): { add: jest.Mock<Promise<unknown>, [string, unknown, unknown]> } => ({
  add: jest.fn<Promise<unknown>, [string, unknown, unknown]>().mockResolvedValue({ id: "job-1" })
});

describe("LineWebhookQueueService", () => {
  it("enqueues LINE webhook payloads into BullMQ with retry options", async () => {
    const queue = createQueue();

    await new LineWebhookQueueService(queue as WebhookQueuePort).enqueue("line-channel-1", {
      events: [{ type: "message" }]
    });

    expect(queue.add).toHaveBeenCalledWith(
      "process-line-webhook",
      {
        lineChannelId: "line-channel-1",
        payload: { events: [{ type: "message" }] }
      },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      })
    );
  });
});
