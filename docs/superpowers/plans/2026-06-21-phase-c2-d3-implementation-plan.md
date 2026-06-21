# Phase C.2 + D.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Automation v2 dual-mode (`immediate` / `customer_reply`) plus RAG hardening (re-index, AI quota UX, knowledge-only fallback).

**Architecture:** Extend automation step JSON with optional `runAfter`; add `WAITING_FOR_REPLY` run status; resume paused runs on inbound LINE webhook before new rule matching. RAG adds re-index endpoint/UI and maps Gemini 429 to structured API errors with frontend Thai copy.

**Tech Stack:** NestJS 10, Prisma 5, Next.js 15, BullMQ/inline queues, Gemini API

**Spec:** `docs/superpowers/specs/2026-06-21-phase-c2-d3-next-plan-design.md` (Approved)

---

## File map

| Area | Files |
|------|-------|
| AI error UX | `apps/api/src/inbox/inbox.service.ts`, `apps/web/app/app/inbox/reply-composer.tsx`, `apps/web/app/lib/i18n.ts` |
| Re-index | `apps/api/src/knowledge/knowledge-document.service.ts`, `knowledge-document.controller.ts`, `apps/web/app/app/settings/knowledge-document-manager.tsx`, `prisma/schema.prisma` (AuditAction) |
| Automation v2 | `prisma/schema.prisma`, migration, `automation-step.types.ts`, `automation-step.parser.ts`, `automation-engine.service.ts`, `automation.service.ts`, `line-webhook.service.ts`, `automation-manager.tsx`, `i18n.ts` |
| Tests | `automation-engine.service.spec.ts`, `automation-step.parser.spec.ts`, `inbox.service.spec.ts`, `knowledge-document.service.spec.ts` |

---

## Wave 1 — D.3 AI quota UX (quick win)

### Task 1: Return structured 429 instead of 502 for LLM quota

**Files:**
- Modify: `apps/api/src/inbox/inbox.service.ts` (~`throwAiSuggestError`, `aiSuggest` catch)
- Test: `apps/api/src/inbox/inbox.service.spec.ts`

- [ ] **Step 1: Write failing test** — `aiSuggest` when Gemini throws message containing `status 429` → HTTP 429 (or 422) body `{ success: false, error: { code: "AI_PROVIDER_RATE_LIMITED" } }`
- [ ] **Step 2: Run test** — expect FAIL
- [ ] **Step 3: Implement** — use `HttpStatus.TOO_MANY_REQUESTS` for provider quota; keep `502` only for unknown provider errors
- [ ] **Step 4: Run test** — PASS
- [ ] **Step 5: Commit** — `fix(api): return AI_PROVIDER_RATE_LIMITED on Gemini quota`

### Task 2: Frontend Thai message for quota errors

**Files:**
- Modify: `apps/web/app/app/inbox/reply-composer.tsx`
- Modify: `apps/web/app/lib/i18n.ts`

- [ ] **Step 1: Add i18n keys** — `aiProviderRateLimited`, `aiProviderNotConfigured`
- [ ] **Step 2: Map error codes** in catch block (`AI_PROVIDER_RATE_LIMITED`, `429`, quota strings)
- [ ] **Step 3: Manual check** — button shows Thai message, not raw `502`
- [ ] **Step 4: Commit** — `fix(web): show Thai AI quota error in inbox`

---

## Wave 2 — D.3 Re-index

### Task 3: AuditAction + re-index service method

**Files:**
- Modify: `prisma/schema.prisma` — add `KNOWLEDGE_DOCUMENT_REINDEX_REQUESTED`
- Create: migration `add_knowledge_reindex_audit`
- Modify: `apps/api/src/knowledge/knowledge-document.service.ts`
- Test: `apps/api/src/knowledge/knowledge-document.service.spec.ts`

- [ ] **Step 1: Migration** — new enum value only
- [ ] **Step 2: Write test** — `requestReindex(tenantId, userId, { all: true })` sets docs to `PENDING`, enqueues ingest jobs, writes audit
- [ ] **Step 3: Implement** — filter by `documentIds` / `lineChannelId` / `all`; tenant-scoped; soft-deleted excluded
- [ ] **Step 4: Run tests** — PASS
- [ ] **Step 5: Commit** — `feat(api): knowledge document re-index service`

### Task 4: Re-index API endpoint

**Files:**
- Create: `apps/api/src/knowledge/dto/reindex-knowledge-documents.dto.ts`
- Modify: `apps/api/src/knowledge/knowledge-document.controller.ts`

- [ ] **Step 1: DTO** — validate `documentIds?`, `lineChannelId?`, `all?` (at least one scope)
- [ ] **Step 2: POST `/reindex`** — `@Roles(OWNER, ADMIN)`, delegate to service
- [ ] **Step 3: Integration test** or controller unit test
- [ ] **Step 4: Commit** — `feat(api): POST knowledge/documents/reindex`

### Task 5: Re-index UI

**Files:**
- Modify: `apps/web/app/app/settings/knowledge-document-manager.tsx`
- Modify: `apps/web/app/lib/i18n.ts`

- [ ] **Step 1: Per-row Re-index button** when status `READY` or `FAILED`
- [ ] **Step 2: Re-index all button** with confirm dialog
- [ ] **Step 3: Show status badge** — PENDING / READY / FAILED + last updated
- [ ] **Step 4: Commit** — `feat(web): knowledge re-index controls`

---

## Wave 3 — C.2 Automation v2 engine

### Task 6: Schema + step types

**Files:**
- Modify: `prisma/schema.prisma` — `WAITING_FOR_REPLY` on `AutomationRunStatus`
- Create: migration
- Modify: `apps/api/src/automation/automation-step.types.ts`
- Modify: `apps/api/src/automation/automation-step.parser.ts`
- Test: `apps/api/src/automation/automation-step.parser.spec.ts`

- [ ] **Step 1: Migration** — add enum value
- [ ] **Step 2: Type** — `StepRunAfter = "immediate" | "customer_reply"`
- [ ] **Step 3: Parser tests** — default `immediate`; step 0 with `runAfter` → 400; step 2+ accepts `customer_reply`
- [ ] **Step 4: Implement parser**
- [ ] **Step 5: Commit** — `feat(api): automation step runAfter parser`

### Task 7: Engine pause + resume

**Files:**
- Modify: `apps/api/src/automation/automation-engine.service.ts`
- Modify: `apps/api/src/automation/automation.service.ts`
- Test: `apps/api/src/automation/automation-engine.service.spec.ts`

- [ ] **Step 1: Test pause** — after step 0, step 1 has `runAfter: customer_reply` → run status `WAITING_FOR_REPLY`, `currentStepIndex: 1`, no second push yet
- [ ] **Step 2: Test resume** — `resumeWaitingRuns(conversationId)` executes step 1, completes run
- [ ] **Step 3: Test regression** — two `immediate` reply steps still push twice in one trigger
- [ ] **Step 4: Implement** — `shouldPauseBeforeStep(stepIndex, steps)`, `pauseForCustomerReply`, `resumeWaitingRuns`
- [ ] **Step 5: Commit** — `feat(api): automation customer_reply pause/resume`

### Task 8: Webhook hook

**Files:**
- Modify: `apps/api/src/line/line-webhook.service.ts`

- [ ] **Step 1: After inbound message saved**, call `automationService.resumeWaitingRuns(tenantId, conversationId, { messageId })` **before** `dispatchEvent(MESSAGE_RECEIVED)`
- [ ] **Step 2: Dedupe** — same rule that paused does not also start new run on resume message (skip dispatch for that rule id if just resumed)
- [ ] **Step 3: Commit** — `feat(api): resume automation on inbound LINE message`

---

## Wave 4 — C.2 Automation UI

### Task 9: Settings form checkbox

**Files:**
- Modify: `apps/web/app/app/settings/automation-manager.tsx`
- Modify: `apps/web/app/lib/i18n.ts`

- [ ] **Step 1: StepDraft** — add `runAfter: "immediate" | "customer_reply"`
- [ ] **Step 2: Checkbox on step index ≥ 1** — maps to `runAfter`
- [ ] **Step 3: `draftToPayload` / `stepsToDraft`** — round-trip JSON
- [ ] **Step 4: Rule list badge** — `reply-driven` if any step uses `customer_reply`
- [ ] **Step 5: Commit** — `feat(web): automation customer_reply step UI`

---

## Wave 5 — D.3 Resilience

### Task 10: Knowledge-only fallback when LLM fails

**Files:**
- Modify: `apps/api/src/inbox/inbox.service.ts` (~`aiSuggest`)
- Modify: `apps/web/app/app/inbox/reply-composer.tsx` (show citations when `mode: knowledge_only`)

- [ ] **Step 1: Test** — LLM throws rate limit but hybrid context has citations → response `{ mode: "knowledge_only", knowledge_citations, suggestion_text: null }`
- [ ] **Step 2: Implement** — catch provider errors after RAG fetch; return 200 with fallback payload
- [ ] **Step 3: UI** — show excerpts panel, no auto-fill textarea
- [ ] **Step 4: Commit** — `feat(api,web): knowledge-only fallback when AI unavailable`

### Task 11: Embedding 429 on ingest

**Files:**
- Modify: `apps/api/src/knowledge/knowledge-document.service.ts` (`runIngestJob`)
- Modify: `apps/api/src/knowledge/embedding.service.ts` (optional clearer error class)

- [ ] **Step 1: Catch quota errors** — set doc `FAILED`, store error message, audit failure
- [ ] **Step 2: Test** — mock embedding throw 429 → doc FAILED not stuck PENDING
- [ ] **Step 3: Commit** — `fix(api): fail knowledge ingest clearly on embedding quota`

---

## Verification (each wave)

```bash
npm run api:test
npm run api:typecheck
npm run web:typecheck
npx prisma migrate dev --name <wave-name>   # local only
```

Production deploy: ensure `prisma migrate deploy` in start script (already in `api:start`).

---

## After this plan (roadmap)

| Phase | What |
|-------|------|
| **Now** | C.2 + D.3 (this plan) |
| **Dogfooding** | 2–4 weeks real LINE usage; fix P0/P1 |
| **Stage 6** | Reporting Lite dashboard |
| **Stage 7** | KPI Lite (response/resolution time) |
| **Stage E** | Visual automation canvas |
| **Stage F** | AI automation steps + plan credits |
| **Stage 13** | pgvector RAG |

---

## Execution order summary

```
Wave 1 (AI UX) → Wave 2 (Re-index) → Wave 3 (Automation engine) → Wave 4 (Automation UI) → Wave 5 (Fallback)
```

Estimated: **5 waves**, ~11 tasks, each task 15–45 min.
