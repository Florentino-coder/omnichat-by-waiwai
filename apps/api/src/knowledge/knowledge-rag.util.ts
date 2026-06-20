export type ScoredChunk = {
  content: string;
  documentTitle: string;
  score: number;
};

export type KnowledgeCitation = {
  type: "article" | "document";
  title: string;
  score?: number;
  excerpt?: string;
};

export type HybridKnowledgeResult = {
  context: string;
  citations: KnowledgeCitation[];
};

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function rankChunksByEmbedding<T extends { content: string; documentTitle: string; embedding: number[] | null }>(
  chunks: T[],
  queryEmbedding: number[],
  limit = 5,
  minScore = 0.2
): ScoredChunk[] {
  return chunks
    .filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)
    .map((chunk) => ({
      content: chunk.content,
      documentTitle: chunk.documentTitle,
      score: cosineSimilarity(queryEmbedding, chunk.embedding as number[])
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function formatRagContext(chunks: ScoredChunk[]): string {
  if (chunks.length === 0) {
    return "ไม่มีข้อมูลจากเอกสารที่เกี่ยวข้อง";
  }

  return chunks
    .map(
      (chunk, index) =>
        `${index + 1}. [${chunk.documentTitle}] (score ${chunk.score.toFixed(2)})\n${chunk.content}`
    )
    .join("\n\n");
}

export function mergeKnowledgeContext(articleContext: string, ragContext: string): string {
  const articleBlock = articleContext.trim();
  const ragBlock = ragContext.trim();

  if (!ragBlock || ragBlock === "ไม่มีข้อมูลจากเอกสารที่เกี่ยวข้อง") {
    return articleBlock;
  }

  if (!articleBlock || articleBlock === "ไม่มี") {
    return ragBlock;
  }

  return `${articleBlock}\n\n--- จากเอกสาร (semantic) ---\n${ragBlock}`;
}
