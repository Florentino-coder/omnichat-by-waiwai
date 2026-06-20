import type { KnowledgeArticle } from "@prisma/client";

const MIN_TOKEN_LENGTH = 2;
const MAX_TOKENS = 20;

export function tokenizeSearchQuery(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(/[\s,;.:!?()[\]{}'"\/\\|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);

  return [...new Set(tokens)].slice(0, MAX_TOKENS);
}

export function scoreKnowledgeArticle(
  article: Pick<KnowledgeArticle, "title" | "content" | "keywords">,
  tokens: string[]
): number {
  if (tokens.length === 0) {
    return 0;
  }

  const title = article.title.toLowerCase();
  const content = article.content.toLowerCase();
  const keywords = article.keywords.map((keyword) => keyword.toLowerCase());

  let score = 0;

  for (const token of tokens) {
    if (keywords.some((keyword) => keyword.includes(token) || token.includes(keyword))) {
      score += 3;
    }
    if (title.includes(token)) {
      score += 2;
    }
    if (content.includes(token)) {
      score += 1;
    }
  }

  return score;
}

export function rankKnowledgeArticles<T extends Pick<KnowledgeArticle, "title" | "content" | "keywords">>(
  articles: T[],
  queryText: string,
  limit = 5
): T[] {
  const tokens = tokenizeSearchQuery(queryText);
  if (tokens.length === 0) {
    return articles.slice(0, limit);
  }

  return articles
    .map((article) => ({
      article,
      score: scoreKnowledgeArticle(article, tokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.article);
}

export function formatKnowledgeContext(
  articles: Pick<KnowledgeArticle, "title" | "content" | "category">[]
): string {
  if (articles.length === 0) {
    return "ไม่มี";
  }

  return articles
    .map((article, index) => {
      const categoryPrefix = article.category ? `[${article.category}] ` : "";
      return `${index + 1}. ${categoryPrefix}${article.title}\n${article.content.trim()}`;
    })
    .join("\n\n");
}
