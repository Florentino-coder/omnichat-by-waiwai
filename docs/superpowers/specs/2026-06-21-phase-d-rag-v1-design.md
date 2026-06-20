# Phase D — RAG v1 Design

Date: 2026-06-21  
Stage: Pre-Automation / Knowledge (Zaapi parity path)  
Status: Implemented

## Goal

Semantic knowledge retrieval for AI replies: paste long text → chunk → embed → cosine search merged with existing keyword FAQ articles.

## Scope (In)

- `KnowledgeDocument` + `KnowledgeChunk` models
- Status lifecycle: `PENDING` → `READY` | `FAILED`
- CRUD API: `GET/POST/DELETE /api/v1/knowledge/documents`, `POST .../reindex`
- Text ingest: split ~800 chars, overlap 120
- Embeddings: Gemini batch (fallback OpenAI); empty vectors in test env
- Hybrid context: keyword-ranked `KnowledgeArticle` + top-k semantic chunks
- `KnowledgeService.buildKnowledgeContext()` delegates to hybrid builder
- Settings UI: Knowledge tab → **FAQ Articles** | **RAG Documents**
- Audit: `KNOWLEDGE_DOCUMENT_CREATED`, `DELETED`, `INGESTED`, `INGEST_FAILED`

## Scope (Out — Phase D.2+)

- PDF/DOCX upload + R2 storage
- URL scrape ingest
- BullMQ async ingest queue
- pgvector / OpenSearch (MVP uses JSON embedding + in-app cosine)
- Re-ranking / citation UI in inbox

## Data Model

```prisma
model KnowledgeDocument {
  tenantId, lineChannelId?, title, rawText
  source TEXT | FILE
  status PENDING | READY | FAILED
  chunkCount, errorMessage?
}

model KnowledgeChunk {
  tenantId, documentId, chunkIndex, content
  embedding Json?  // float[]
}
```

## Ingest Flow

1. `POST /knowledge/documents` with `title`, `rawText` (min 20 chars), optional `lineChannelId`
2. Create document `PENDING`, audit `KNOWLEDGE_DOCUMENT_CREATED`
3. Split text → chunks
4. Batch embed via `EmbeddingService`
5. Save chunks with embeddings → `READY`, audit `INGESTED`
6. On failure → `FAILED` + `errorMessage`, audit `INGEST_FAILED`

## Retrieval Flow

1. AI draft/suggest calls `KnowledgeService.buildKnowledgeContext(tenantId, query, channelId?)`
2. Keyword path: existing article rank by query tokens
3. Semantic path: embed query → cosine sim vs READY chunks (tenant + channel scope)
4. Merge + dedupe → formatted context block for prompt

## RBAC

| Action   | OWNER | ADMIN | AGENT | QC | VIEWER |
|----------|-------|-------|-------|-----|--------|
| List     | ✅    | ✅    | ✅    | ✅  | ✅     |
| Create   | ✅    | ✅    | ✅    | ❌  | ❌     |
| Reindex  | ✅    | ✅    | ✅    | ❌  | ❌     |
| Delete   | ✅    | ✅    | ❌    | ❌  | ❌     |

## Env

- `GEMINI_API_KEY` (preferred) or `OPENAI_API_KEY` for production ingest/retrieve
- Without keys: ingest throws 400; retrieve falls back to articles-only

## Bugfix (same release)

Scenario create 400: `apiFetch` now auto-sets `Content-Type: application/json` when body is string. NestJS ValidationPipe was receiving empty body.

## Next

Phase E — Visual automation canvas  
Phase F — AI auto-reply steps + credits
