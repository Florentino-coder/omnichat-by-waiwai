# Phase F-alpha — Implementation Summary

**Date:** 2026-06-22  
**Status:** Code complete (Waves 1–5); staging smoke pending  
**Design:** `docs/superpowers/specs/2026-06-22-phase-f-alpha-ai-auto-reply-design.md`  
**Ops:** `docs/deployment/ai-auto-reply-ops.md`

---

## Goal

When enabled per tenant, inbound **LINE text** triggers RAG-backed LLM reply pushed to customer **without admin clicking "AI ร่างคำตอบ"**. Master toggle default **OFF**.

---

## Architecture

```
LINE webhook (inbound TEXT persisted)
  → resume automation (existing)
  → dispatch automation rules (existing)
  → scenario match / tag actions (existing)
  → AiAutoReplyService.tryAutoReply()     ← NEW
       ├─ guards (toggle, mode, escalation, debounce, credits, rate)
       ├─ AiReplyGeneratorService (shared with manual aiSuggest)
       ├─ LineReplyService.replyText(..., actor "system")
       └─ audit AI_AUTO_REPLY_* + credit check
```

---

## Wave 1 — Shared AI reply generator

| Component | Path | Description |
|-----------|------|-------------|
| `AiReplyGeneratorService` | `apps/api/src/ai/ai-reply-generator.service.ts` | Extracted prompt build + LLM call from `InboxService.aiSuggest` |
| `AiModule` | `apps/api/src/ai/ai.module.ts` | Exports generator for inbox + line modules |
| LLM util | `apps/api/src/ai/ai-llm.util.ts` | Shared provider dispatch helpers |
| `InboxService` | `apps/api/src/inbox/inbox.service.ts` | Manual `aiSuggest` delegates to generator (no behavior change) |

**Shared generation inputs:** last 15 messages, customer profile, tags, notes, hybrid RAG (`KnowledgeService.buildKnowledgeContext`), matched scenario instructions (read-only), tenant AI persona/gender/provider, post-process trim + markdown strip, max 5000 chars.

**Not created for auto-reply:** `AiSuggestion` row (audit-only in v1).

---

## Wave 2 — Schema + settings API + UI

### Database (`prisma/schema.prisma`)

Migration: `20260622200000_add_ai_auto_reply_settings`

| Field | Type | Default |
|-------|------|---------|
| `enableAiAutoReply` | Boolean | `false` |
| `aiAutoReplyMode` | `AiAutoReplyMode` | `OFF_HOURS_ONLY` |
| `aiAutoReplyBusinessHourStart` | Int | `8` |
| `aiAutoReplyBusinessHourEnd` | Int | `23` |
| `aiAutoReplyInstructions` | String? | null |
| `aiEscalationKeywords` | String[] | Thai defaults (see below) |

**Enum `AiAutoReplyMode`:** `OFF`, `WHEN_UNASSIGNED`, `ALWAYS`, `OFF_HOURS_ONLY`

**Default escalation keywords:**  
`แอดมิน`, `คุยกับคน`, `โทรหา`, `ติดต่อเจ้าหน้าที่`, `ขอคุยกับคน`, `พูดกับคน`, `ฝ่ายบริการ`, `โทร`

**Audit enums added:** `AI_AUTO_REPLY_SENT`, `AI_AUTO_REPLY_SKIPPED`, `AI_AUTO_REPLY_ESCALATED`, `AI_AUTO_REPLY_FAILED`

### API

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/inbox/settings` | ADMIN, AGENT, QC | Read settings incl. auto-reply fields |
| `PATCH` | `/api/v1/inbox/settings` | ADMIN | Update toggle, mode, hours, keywords, instructions |
| `POST` | `/api/v1/inbox/ai-test` | OWNER, ADMIN | Test LLM reply before enabling |

DTO: `apps/api/src/inbox/dto/update-inbox-settings.dto.ts`  
Constants: `apps/api/src/ai/ai-auto-reply.constants.ts`

### Web UI

`apps/web/app/app/settings/ai-settings.tsx`

- Toggle **เปิด AI ตอบแชทอัตโนมัติ**
- Mode select + business hour start/end
- Escalation keywords (comma-separated, max 20)
- Extra instructions textarea
- Warning: re-index Knowledge + AI Test before enable
- i18n: `apps/web/app/lib/i18n.ts` (TH/EN)

---

## Wave 3 — AiAutoReplyService + webhook hook

| Component | Path | Description |
|-----------|------|-------------|
| `AiAutoReplyService` | `apps/api/src/ai/ai-auto-reply.service.ts` | Guards, escalate, generate, send, audit |
| Webhook hook | `apps/api/src/line/line-webhook.service.ts` | Calls `tryAutoReply()` after automation dispatch (text only) |
| Tests | `ai-auto-reply.service.spec.ts`, `line-webhook.service.spec.ts` | All skip reasons + invocation |

### Guard order (all must pass before LLM)

1. `enableAiAutoReply === false` → `disabled`
2. Inbound not TEXT / empty → `non_text`
3. Mode + assignment + business hours → `mode_blocked`
4. Escalation keyword substring match → `escalated` (+ tag `ai-escalated`)
5. Outbound in last 3s on conversation → `debounce`
6. `assertAiCreditAvailable` fails → `no_credits`
7. Redis rate limit → `rate_limited`
8. LLM not configured / 429 → `provider_unavailable`

### Rate limits (Redis)

| Key | Limit | TTL |
|-----|-------|-----|
| `ai-auto-reply:conv:{conversationId}` | 5 / hour | 1h |
| `ai-auto-reply:tenant:{tenantId}` | 200 / day | 24h |

### Send path

`LineReplyService.replyText(tenantId, "system", conversationId, text)` — system actor, tenant-scoped.

### Mode semantics

| Mode | Fires when |
|------|------------|
| `OFF_HOURS_ONLY` | Local hour **outside** `[start, end)` (default 08:00–23:00 Bangkok → AI at 00:00–07:59) |
| `WHEN_UNASSIGNED` | `assignedToMemberId === null` |
| `ALWAYS` | Every inbound text |
| `OFF` | Never |

Uses tenant `timezone` (default `Asia/Bangkok`) via `Intl` + fallback Bangkok hour.

---

## Wave 4 — Automation polish (Track 3)

| Component | Path | Description |
|-----------|------|-------------|
| Wait timeout constants | `apps/api/src/automation/automation-wait-timeout.constants.ts` | 24h threshold |
| `failStaleWaitingForReplyRuns()` | `apps/api/src/automation/automation.service.ts` | `WAITING_FOR_REPLY` > 24h → `FAILED` + `AUTOMATION_RUN_FAILED` audit |
| Scheduler | `apps/api/src/automation/automation-wait-timeout.scheduler.ts` | Hourly `@Cron` |
| Module | `apps/api/src/automation/automation.module.ts` | Registers scheduler |
| Webhook dedupe | `line-webhook.service.spec.ts` | Resume passes `skipRuleIds` from resumed rules |
| Rule templates | `apps/web/app/app/settings/automation-manager.tsx` | **Off-hours welcome** (`OFF_HOURS` trigger + welcome text); **FAQ handoff** (keyword match + reply + wait for customer → tag) |
| i18n | `apps/web/app/lib/i18n.ts` | Template labels TH/EN |

---

## Wave 5 — Inbox UX + outbound metadata

| Component | Path | Description |
|-----------|------|-------------|
| Outbound metadata | `apps/api/src/line/line-reply.service.ts` | Stores `rawPayload.omnichatMeta.triggeredBy`: `"system"` (AI auto-reply) or `"automation"` |
| Inbox badge | `apps/web/app/app/inbox/inbox-client.tsx` | `isAiAutoReplyOutboundMessage()` — badge when last outbound `triggeredBy === "system"` |
| List card | `apps/web/components/inbox/ConversationList/ConversationCard.tsx` | `aiAutoReplyBadge` prop |
| Thread header | `apps/web/components/inbox/ChatWindow/ChatHeader.tsx` | Header badge |
| i18n | `apps/web/app/lib/i18n.ts` | "AI ตอบอัตโนมัติ" / "AI auto-reply" |
| Tests | `line-reply.service.spec.ts` | Asserts `rawPayload` on automation/system send |

**Note:** Badge shows **AI auto-reply only**, not automation-triggered sends (`triggeredBy: "automation"`).

---

## Wave 0 — Ops (documentation)

| Deliverable | Path |
|-------------|------|
| Ops + staging smoke guide | `docs/deployment/ai-auto-reply-ops.md` |
| This summary | `docs/superpowers/specs/2026-06-22-phase-f-alpha-implementation-summary.md` |

Founder tasks (not code): Gemini billing, re-index all, 10 FAQ AI Test, staging LINE smoke < 10s.

---

## Success criteria (from spec)

| Criterion | Status |
|-----------|--------|
| Enable toggle → LINE reply < 10s without admin | ⏳ Staging smoke |
| Escalation keyword → no send, tag + audit | ✅ |
| OFF_HOURS_ONLY outside/inside hours | ✅ |
| WHEN_UNASSIGNED skips assigned conv | ✅ |
| Credits exhausted → skip, no crash | ✅ |
| Tenant-scoped + audited sends | ✅ |
| Unit + webhook tests | ✅ |
| Inbox badge on system outbound | ✅ |

---

## Out of scope (v1)

- Automation step `AI_AUTO_REPLY` (F-beta)
- Confidence score gating
- Multi-language auto-detect
- Proactive AI messages
- New billing model beyond existing AI credits
- pgvector / OpenSearch

---

## Key files index

```
apps/api/src/ai/
  ai.module.ts
  ai-reply-generator.service.ts
  ai-auto-reply.service.ts
  ai-auto-reply.constants.ts
  ai-llm.util.ts

apps/api/src/line/
  line-webhook.service.ts      # hook
  line-reply.service.ts        # triggeredBy metadata

apps/api/src/inbox/
  inbox.service.ts             # settings + aiSuggest delegate
  inbox.controller.ts          # PATCH settings, ai-test
  dto/update-inbox-settings.dto.ts

apps/api/src/automation/
  automation.service.ts        # wait timeout
  automation-wait-timeout.scheduler.ts

apps/web/app/app/settings/
  ai-settings.tsx
  automation-manager.tsx       # templates

apps/web/app/app/inbox/
  inbox-client.tsx             # badge logic

prisma/migrations/20260622200000_add_ai_auto_reply_settings/
```

---

## Git commits (Waves 1–3)

| Wave | Commit | Message area |
|------|--------|--------------|
| 1 | `70ba89e` | Extract AiReplyGeneratorService |
| 2 | `9b8d699` | Schema + settings API + UI |
| 3 | `042c9e8` | AiAutoReplyService + webhook |

Waves 4–5: implemented in working tree (commit pending).

---

## Next steps

1. Run staging smoke per `docs/deployment/ai-auto-reply-ops.md`
2. Dogfood 1–2 weeks on one LINE channel
3. Fix P0/P1 (wrong answers, double replies, quota)
4. Then Stage 6 Reporting or F-beta automation AI step

---

## F-alpha+ — Escalation inbox UX (2026-06-22)

| Change | Location |
|--------|----------|
| Tag `ai-escalated` created with color `#F59E0B` | `ai-auto-reply.service.ts` |
| Inbound message `omnichatMeta.escalation` + `matchedKeywords` | same |
| Badge **ขอคุยแอดมิน** list + header | `ConversationCard`, `ChatHeader` |
| Amber left border on escalated conv | `ConversationCard` |
| Filter tab **ต้องการแอดมิน** | `inbox-client.tsx` |
| Amber inbound bubble + label | `MessageBubble` variant `inbound-escalation` |

_Old escalated threads: badge/filter from tag; bubble highlight only on new escalations with metadata._

---

_Last updated: 2026-06-22_
