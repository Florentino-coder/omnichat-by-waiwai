import { EmbeddingService } from "./embedding.service";

describe("EmbeddingService", () => {
  const originalFetch = global.fetch;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.GEMINI_EMBEDDING_MODEL = originalEmbeddingModel;
    jest.restoreAllMocks();
  });

  it("uses gemini-embedding-001 with retrieval task types by default", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.GEMINI_EMBEDDING_MODEL;

    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>(async (_url, _init) => ({
      ok: true,
      json: async () => ({
        embeddings: [{ values: [0.1, 0.2] }]
      })
    } as Response));
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new EmbeddingService();
    await service.embedTexts(["doc chunk"]);
    await service.embedQuery("search query");

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const documentInit = fetchMock.mock.calls[0]?.[1];
    const documentRequest = JSON.parse(String(documentInit?.body));
    expect(documentRequest.requests[0].model).toBe("models/gemini-embedding-001");
    expect(documentRequest.requests[0].taskType).toBe("RETRIEVAL_DOCUMENT");

    const queryInit = fetchMock.mock.calls[1]?.[1];
    const queryRequest = JSON.parse(String(queryInit?.body));
    expect(queryRequest.requests[0].taskType).toBe("RETRIEVAL_QUERY");
  });
});
