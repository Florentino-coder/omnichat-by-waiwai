# Stage 11 — Full AI Agent (Sprints 1–4) Design

**Date:** 2026-06-24  
**Status:** Implemented

## Overview

Stage 11 extends F-alpha AI Auto-Reply with escalation UX, automation integration, reporting, and AI QA lite sampling.

## Sprint 1 — Escalation UX + Agent Notification

### Backend
- `GET /inbox/conversations?tagName=ai-escalated` — server-side tag filter on `listConversations`
- `GET /inbox/escalations/count` — count of open conversations with `ai-escalated` tag
- Escalation metadata stored on inbound message `rawPayload.omnichatMeta`: `escalationReason`, `matchedKeywords`, `aiDraftText`

### Frontend
- Inbox filter pill "Needs admin" (existing) with count badge
- Escalation bubble shows reason (keyword / low_confidence / knowledge_only) + AI draft when available
- Highlight escalated conversations in list

### Auto-assign
- Reuse existing `escalateConversationForHumanReview`: sets priority HIGH, reopens unassigned conversations

## Sprint 2 — Automation `AI_AUTO_REPLY` Step

### Backend
- New step type `AI_AUTO_REPLY` in `AUTOMATION_STEP_TYPES`
- `AiAutomationReplyService` calls `AiReplyGeneratorService`, respects confidence threshold, sends via `LineReplyService` with `triggeredBy: "automation"`
- 3s debounce guard (shared `AI_AUTO_REPLY_DEBOUNCE_MS`)
- Audit action `AUTOMATION_AI_REPLY_SENT`

### Frontend
- Automation manager step picker includes "AI Auto Reply"

## Sprint 3 — AI Reporting

### API
- `GET /reporting/ai-summary?from=&to=` — counts from `audit_logs` (SENT, ESCALATED, SKIPPED by reason) + `usage_counters` AI credits

### Frontend
- AI metrics section on Reports page

## Sprint 4 — AI QA Lite

### Schema
- `ai_qa_scores` table: tenantId, conversationId, messageId, relevanceScore, toneScore, hallucinationScore, createdAt

### Jobs
- Daily cron samples ~10% of previous day's `AI_AUTO_REPLY_SENT` audit logs
- `AiQaScorerService` scores via Gemini (1–5 each dimension)
- Warn log if tenant daily average < 3

### API
- `GET /reporting/ai-qa-summary` — tenant-scoped QA aggregates
- `GET /super-admin/ai/qa-summary` — platform-wide QA aggregates

## Migrations

1. `20260625140000_stage11_ai_qa_and_automation_audit` — `AUTOMATION_AI_REPLY_SENT` enum + `ai_qa_scores` table

## Testing

- `inbox.service.spec.ts` — tag filter, escalation count
- `automation-engine.service.spec.ts` — AI_AUTO_REPLY step
- `ai-automation-reply.service.spec.ts` — debounce, confidence, send
- `reporting.service.spec.ts` — ai-summary, ai-qa-summary
- `ai-qa.service.spec.ts` — sampling and scoring storage
