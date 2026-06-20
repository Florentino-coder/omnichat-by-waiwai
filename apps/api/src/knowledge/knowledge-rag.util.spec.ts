import {
  cosineSimilarity,
  formatRagContext,
  mergeKnowledgeContext,
  rankChunksByEmbedding
} from "./knowledge-rag.util";

describe("knowledge-rag.util", () => {
  it("computes cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("ranks chunks by embedding score", () => {
    const ranked = rankChunksByEmbedding(
      [
        {
          content: "near",
          documentTitle: "Doc A",
          embedding: [1, 0]
        },
        {
          content: "far",
          documentTitle: "Doc B",
          embedding: [0, 1]
        }
      ],
      [1, 0],
      2
    );

    expect(ranked[0]?.content).toBe("near");
  });

  it("merges article and rag context", () => {
    const merged = mergeKnowledgeContext("1. FAQ\nanswer", "1. [Doc] chunk");
    expect(merged).toContain("FAQ");
    expect(merged).toContain("semantic");
  });

  it("formats rag context block", () => {
    const formatted = formatRagContext([
      { content: "chunk text", documentTitle: "Policy", score: 0.91 }
    ]);

    expect(formatted).toContain("[Policy]");
    expect(formatted).toContain("chunk text");
  });
});
