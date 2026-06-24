# Stage 12 — AI QA & Policy (Sprints 1–4) Design

**Date:** 2026-06-24  
**Status:** Approved  
**Depends on:** Stage 11 (AI auto-reply, QA lite), Stage 13 audit log UI (optional same commit)

---

## Goal

Give tenants **policy guardrails** on outbound AI text, a **QA Center** to review sampled scores, **automatic disable** of auto-reply when quality stays poor, and a **compliance summary** tying policy blocks, escalations, low QA, and guardrail events together.

---

## Sprint 1 — Policy Engine

### Schema

Add to `tenant_settings`:

| Column | Type | Notes |
|--------|------|-------|
| `ai_policy_blocked_topics` | `text[]` | Comma-normalized keywords; case-insensitive substring match on outbound reply text |

Add `AuditAction`: `AI_POLICY_BLOCKED`.

### Service

`AiPolicyService.checkReply(text, blockedTopics)` → `{ allowed: boolean, matchedTopics: string[] }`.

Reuse `getMatchedEscalationKeywords` / `normalizeEscalationKeywords` from `ai-auto-reply.constants.ts` (same matching semantics).

### Integration points

| Path | Behavior on block |
|------|-------------------|
| `AiAutoReplyService` | Skip LINE send; escalate like `low_confidence` (tag `ai-escalated`, draft saved); audit `AI_POLICY_BLOCKED` |
| `AiAutomationReplyService` | Skip send; audit `AI_POLICY_BLOCKED`; tag conversation escalated |
| `LineReplyService.replyText` when `aiSuggestionId` present | Reject with 400 before LINE API call; audit `AI_POLICY_BLOCKED` |

### Settings UI

- Textarea on AI settings (comma-separated), persisted via existing `PATCH /inbox/settings` as `aiPolicyBlockedTopics: string[]`.
- Thai/English labels via `i18n.ts`.

---

## Sprint 2 — QA Center UI

### Schema

Extend `ai_qa_scores`:

| Column | Type |
|--------|------|
| `review_note` | `text?` |
| `reviewed_by` | `uuid?` (user id) |
| `reviewed_at` | `timestamptz?` |

### API (`/api/v1/qa`)

| Route | Roles | Purpose |
|-------|-------|---------|
| `GET /scores` | OWNER, ADMIN, QC | Paginated list; sort low overall first; filters `from`, `to`, `minScore` |
| `GET /scores/:id` | OWNER, ADMIN, QC | Detail with message snippet + dimension scores |
| `PATCH /scores/:id/review` | OWNER, ADMIN, QC | Set `reviewNote`; audit not required (QC note only) |

AGENT read-only own conversations: **deferred v1** (skip).

### UI

- Route: `/app/qa` (top-level nav, like Reports).
- Nav visible to OWNER, ADMIN, QC.
- Table: date, conversation link, scores, overall avg, review note.
- Detail drawer/modal optional; inline review note on PATCH.

---

## Sprint 3 — Auto-guardrails

### Schema

| Column | Type | Notes |
|--------|------|-------|
| `ai_guardrail_notice_at` | `timestamptz?` | Set when guardrail fires; cleared when admin re-enables auto-reply |

Add `AuditAction`: `AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL`.

### Logic (`AiGuardrailService`)

After daily QA sampling:

1. For each tenant with scores, compute **rolling 3-day average** (scores from UTC days D-2..D inclusive) for each of the last 3 complete days.
2. If rolling average **< 3.0** on **3 consecutive days**, set `enableAiAutoReply = false` and `aiGuardrailNoticeAt = now()`.
3. Write audit log `AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL`.

Unit-tested without cron.

### Sampling expansion

`AiQaService.runDailySampling` also samples audit actions:

- `AI_AUTO_REPLY_SENT` (existing)
- `AUTOMATION_AI_REPLY_SENT`
- `AI_SUGGEST_SENT` (programmatic sends only if metadata indicates; otherwise all)

### UI notice

Banner on **Settings → AI** and **Reports** when `aiGuardrailNoticeAt` is set (or latest guardrail audit within 30d). Link to audit log filtered `category=ai`.

---

## Sprint 4 — Compliance Report

### API

| Route | Roles | Purpose |
|-------|-------|---------|
| `GET /qa/compliance-summary?from&to` | OWNER, ADMIN, QC | Counts: policy blocks, escalations, low QA scores (<3 overall), guardrail disables |
| `GET /qa/compliance-export` | OWNER | CSV export (max 10k rows aggregated by day) |

Counts sourced from `audit_logs` + `ai_qa_scores` (tenant-scoped).

### UI

Compliance section on **QA page** with 7d/30d trend cards; cross-link to `/app/settings/audit-logs?category=ai`.

---

## RBAC Summary

| Capability | OWNER | ADMIN | QC | AGENT |
|------------|-------|-------|-----|-------|
| Policy settings | ✓ | ✓ | — | — |
| QA scores list/detail | ✓ | ✓ | ✓ | — |
| QC review note | ✓ | ✓ | ✓ | — |
| Compliance summary | ✓ | ✓ | ✓ | — |
| Compliance CSV | ✓ | — | — | — |

---

## Migrations

1. `20260625150000_stage12_ai_qa_policy` — policy topics, guardrail notice, QA review columns, new audit actions

---

## Out of scope

Email/push notifications, slip vision, new LLM providers, AGENT-scoped QA views.

---

## Self-review (contradictions resolved)

- **Policy field name:** Use `aiPolicyBlockedTopics` (String[]) matching escalation keyword pattern; not a separate JSON blob.
- **QA route:** `/app/qa` chosen over settings sub-route for parity with Reports.
- **Guardrail metric:** Rolling 3-day window average computed per calendar UTC day; three consecutive below-threshold days trigger disable (testable, deterministic).
- **PATCH review:** QC note only; no separate audit action (read-only annotation).
