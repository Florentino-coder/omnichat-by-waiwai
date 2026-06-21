import { createInlineAutomationQueue } from "./automation-queue.service";

describe("createInlineAutomationQueue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("honors delay before processing the next step", async () => {
    const processor = {
      processStep: jest.fn().mockResolvedValue(undefined)
    };
    const queue = createInlineAutomationQueue(processor);

    const addPromise = queue.add(
      "execute-automation-step",
      {
        runId: "run-1",
        tenantId: "tenant-1",
        conversationId: "conv-1",
        ruleId: "rule-1",
        stepIndex: 1
      },
      {
        attempts: 1,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1,
        removeOnFail: 1,
        delay: 5000
      }
    );

    await jest.advanceTimersByTimeAsync(4999);
    expect(processor.processStep).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await addPromise;

    expect(processor.processStep).toHaveBeenCalledTimes(1);
  });
});
