import { GroqClient } from "./groq.client";

describe("GroqClient", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GROQ_API_KEY;
  const originalModel = process.env.GROQ_MODEL;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-key";
    delete process.env.GROQ_MODEL;
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GROQ_API_KEY = originalApiKey;
    process.env.GROQ_MODEL = originalModel;
  });

  it("returns trimmed text from choices[0].message.content", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "  สวัสดีครับ  " } }]
      })
    }) as unknown as typeof fetch;

    const client = new GroqClient();
    await expect(
      client.generateReply({
        systemPrompt: "คุณคือแอดมิน",
        conversationHistory: [{ role: "customer", text: "สอบถามสินค้า" }]
      })
    ).resolves.toBe("สวัสดีครับ");
  });

  it("calls Groq endpoint with correct URL and Authorization header", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] })
    }) as jest.Mock;
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new GroqClient();
    await client.generateReply({
      systemPrompt: "system",
      conversationHistory: [{ role: "customer", text: "hello" }]
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-groq-key"
        })
      })
    );
  });

  it("uses openai/gpt-oss-120b as default model when GROQ_MODEL is not set", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] })
    }) as jest.Mock;
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new GroqClient();
    await client.generateReply({
      systemPrompt: "system",
      conversationHistory: []
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe("openai/gpt-oss-120b");
  });

  it("uses GROQ_MODEL env var when set", async () => {
    process.env.GROQ_MODEL = "llama-3.1-8b-instant";
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] })
    }) as jest.Mock;
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new GroqClient();
    await client.generateReply({ systemPrompt: "s", conversationHistory: [] });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe("llama-3.1-8b-instant");
  });

  it("maps customer→user and agent→assistant in messages array", async () => {
    const mockFetch: jest.Mock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] })
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new GroqClient();
    await client.generateReply({
      systemPrompt: "sys",
      conversationHistory: [
        { role: "customer", text: "question" },
        { role: "agent", text: "answer" }
      ]
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]).toMatchObject({ role: "system", content: "sys" });
    expect(body.messages[1]).toMatchObject({ role: "user", content: "question" });
    expect(body.messages[2]).toMatchObject({ role: "assistant", content: "answer" });
  });

  it("throws when GROQ_API_KEY is not set", async () => {
    delete process.env.GROQ_API_KEY;
    const client = new GroqClient();
    await expect(
      client.generateReply({ systemPrompt: "s", conversationHistory: [] })
    ).rejects.toThrow("GROQ_API_KEY is not defined");
  });

  it("throws with status code when API returns non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limit exceeded"
    }) as unknown as typeof fetch;

    const client = new GroqClient();
    await expect(
      client.generateReply({ systemPrompt: "s", conversationHistory: [] })
    ).rejects.toThrow("Groq API failed with status 429");
  });

  it("throws when response structure is missing choices", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    }) as unknown as typeof fetch;

    const client = new GroqClient();
    await expect(
      client.generateReply({ systemPrompt: "s", conversationHistory: [] })
    ).rejects.toThrow("Invalid response structure from Groq API");
  });
});
