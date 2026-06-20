import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      return this.embedWithGemini(texts, geminiKey, "RETRIEVAL_DOCUMENT");
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      return this.embedWithOpenAI(texts, openAiKey);
    }

    if (process.env.NODE_ENV === "test") {
      return texts.map(() => []);
    }

    throw new Error("No embedding provider configured (GEMINI_API_KEY or OPENAI_API_KEY)");
  }

  async embedQuery(text: string): Promise<number[]> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const [embedding] = await this.embedWithGemini([text], geminiKey, "RETRIEVAL_QUERY");
      return embedding ?? [];
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      const [embedding] = await this.embedWithOpenAI([text], openAiKey);
      return embedding ?? [];
    }

    if (process.env.NODE_ENV === "test") {
      return [];
    }

    throw new Error("No embedding provider configured (GEMINI_API_KEY or OPENAI_API_KEY)");
  }

  private async embedWithGemini(
    texts: string[],
    apiKey: string,
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
  ): Promise<number[][]> {
    const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          taskType,
          content: { parts: [{ text }] }
        }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Gemini embedding error: ${response.status} - ${errorText}`);
      throw new Error(`Gemini embedding failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      embeddings?: Array<{ values?: number[] }>;
    };

    const embeddings = data.embeddings?.map((entry) => entry.values ?? []) ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error("Gemini embedding response size mismatch");
    }

    return embeddings;
  }

  private async embedWithOpenAI(texts: string[], apiKey: string): Promise<number[][]> {
    const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: texts
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenAI embedding error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI embedding failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };

    const embeddings = data.data?.map((entry) => entry.embedding ?? []) ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error("OpenAI embedding response size mismatch");
    }

    return embeddings;
  }
}
