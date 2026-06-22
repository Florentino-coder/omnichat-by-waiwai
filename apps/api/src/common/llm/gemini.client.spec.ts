import { GeminiClient } from "./gemini.client";

describe("GeminiClient", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  it("returns trimmed text from Gemini response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "  สวัสดีค่ะ  " }] }
          }
        ]
      })
    }) as unknown as typeof fetch;

    const client = new GeminiClient();
    await expect(
      client.generateReply({
        systemPrompt: "system",
        conversationHistory: [{ role: "customer", text: "hello" }]
      })
    ).resolves.toBe("สวัสดีค่ะ");
  });

  it("retries once on empty response then throws with finishReason", async () => {
    const emptyResponse = {
      candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "" }] } }],
      usageMetadata: { totalTokenCount: 10 }
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse
      }) as unknown as typeof fetch;

    const client = new GeminiClient();
    await expect(
      client.generateReply({
        systemPrompt: "system",
        conversationHistory: [{ role: "customer", text: "hello" }]
      })
    ).rejects.toThrow("Gemini returned empty content (finishReason=MAX_TOKENS)");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 503 with exponential backoff then succeeds", async () => {
    jest.useFakeTimers();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable"
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate Limited"
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ finishReason: "STOP", content: { parts: [{ text: "after retry" }] } }]
        })
      }) as unknown as typeof fetch;

    const client = new GeminiClient();
    const promise = client.generateReply({
      systemPrompt: "system",
      conversationHistory: [{ role: "customer", text: "hello" }]
    });
    const assertion = expect(promise).resolves.toBe("after retry");

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it("throws after exhausting HTTP retries on 503", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable"
    }) as unknown as typeof fetch;

    const client = new GeminiClient();
    const promise = client.generateReply({
      systemPrompt: "system",
      conversationHistory: [{ role: "customer", text: "hello" }]
    });
    const assertion = expect(promise).rejects.toThrow("Gemini API failed with status 503");

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it("succeeds on retry after first empty response", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ finishReason: "SAFETY", content: { parts: [] } }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ finishReason: "STOP", content: { parts: [{ text: "retry ok" }] } }]
        })
      }) as unknown as typeof fetch;

    const client = new GeminiClient();
    await expect(
      client.generateReply({
        systemPrompt: "system",
        conversationHistory: [{ role: "customer", text: "hello" }]
      })
    ).resolves.toBe("retry ok");
  });
});
