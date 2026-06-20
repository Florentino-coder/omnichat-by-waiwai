# Phase D.2+ — RAG Enhancements Design

Date: 2026-06-21  
Status: In Progress  
Depends on: Phase D RAG v1

## Goal

Extend RAG ingest beyond paste-text: file upload, URL scrape, async indexing, and inbox citations.

## D.2.1 — PDF/DOCX Upload + R2

- `POST /api/v1/knowledge/documents/upload` multipart (`file`, `title`, optional `lineChannelId`)
- Allowed: PDF, DOCX, plain text; max 10 MB
- Upload original to R2 (`FileType.DOCUMENT`, `RetentionType.PERMANENT`)
- Extract text → `rawText`, set `sourceType=FILE`, `mimeType`, `storageKey`
- Audit: existing `KNOWLEDGE_DOCUMENT_CREATED`

## D.2.2 — URL Scrape Ingest

- `POST /api/v1/knowledge/documents/from-url` JSON `{ title, sourceUrl, lineChannelId? }`
- SSRF guard: http/https only, block localhost/private IPs
- Fetch HTML → strip tags/scripts → min 20 chars
- `sourceType=URL`, `sourceUrl` stored

## D.2.3 — BullMQ Async Ingest

- Env `KNOWLEDGE_INGEST_QUEUE_MODE=inline|bullmq` (default `inline`)
- Inline: sync ingest (current behavior)
- BullMQ: create doc `PENDING` → enqueue job → worker runs chunk+embed
- Queue name: `knowledge-ingest`, job: `ingest-document`
- Test env: always inline

## D.2.4 — pgvector (Deferred)

MVP keeps JSON embedding + in-app cosine. pgvector needs DB extension + migration — Stage 13 scope.

## D.2.5 — Citation UI

- `buildHybridKnowledgeContext` returns `{ context, citations }`
- `ai-suggest` response adds `knowledge_citations[]` `{ type, title, score?, excerpt? }`
- Inbox composer shows source chips under AI draft

## RBAC

Same as Phase D v1 for all new endpoints.

## New Dependencies

- `pdf-parse` — PDF text extraction
- `mammoth` — DOCX text extraction
