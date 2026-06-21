# Phase F-alpha — AI Auto-Reply (Webhook MVP)

Date: 2026-06-22  
Status: Approved (founder chose **Approach A**)  
Depends on: Phase D RAG, D.3 hardening, C.2 Automation v2, existing `aiSuggest` pipeline

---

## Context

Customer (tenant) wants **AI to reply on LINE without admin clicking "AI ร่างคำตอบ"**.

Today:

| Feature | Behavior |
|---------|----------|
| `aiSuggest` | Manual — agent clicks button in inbox |
| AI Scenarios | Match inbound → tag/assign/priority only — **no send** |
| Automation | Fixed text/image steps only — **no LLM** |
| RAG + knowledge fallback | Works inside `aiSuggest` |

Roadmap Stage 15–16 (hybrid/full agent) is Post-MVP. This phase delivers a **controlled MVP** faster.

---

## Goal

When enabled, **inbound customer text** on LINE triggers:

1. RAG context + conversation history + tenant AI persona  
2. Gemini/LLM generate reply  
3. Push to LINE via `LineReplyService` as system actor  
4. Audit + credit metering  

**Default OFF** — founder/OWNER must explicitly enable per tenant.

---

## Approved approach: A — Webhook Auto-Reply

Single toggle + policy fields on tenant settings. Hook runs on LINE webhook after message persisted.

**Rejected for v1:**

- **B only** (Automation `AI_AUTO_REPLY` step) — too slow to configure every flow  
- **Full Stage 16** — too large for current customer deadline  
- **A+C combined** — deferred; scenario *instructions* still feed prompt when scenarios match (read-only), no new scenario send action in v1

---

## Architecture

```
LINE webhook (inbound TEXT saved)
  → resume automation (existing)
  → dispatch automation rules (existing)
  → scenario match / actions (existing, tags only)
  → AiAutoReplyService.tryAutoReply()   ← NEW
       ├─ guards (toggle, credits, rate, assignment, escalation)
       ├─ AiReplyGenerator (extracted from aiSuggest core)
       ├─ LineReplyService.replyText(..., "system", ...)
       └─ audit AI_AUTO_REPLY_SENT + credit usage
```

Extract shared generation logic from `InboxService.aiSuggest` into `AiReplyGeneratorService` (or `AiReplyService`) so manual suggest and auto-reply share one prompt/RAG path.

---

## Data model

### `TenantSettings` (migration)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `enableAiAutoReply` | Boolean | **false** | Master kill switch |
| `aiAutoReplyMode` | enum | **`OFF_HOURS_ONLY`** | See modes below |
| `aiAutoReplyBusinessHourStart` | Int | **8** | Bangkok local hour (inclusive) — open |
| `aiAutoReplyBusinessHourEnd` | Int | **23** | Bangkok local hour (exclusive) — close |
| `aiAutoReplyInstructions` | String? | null | Extra system prompt (Thai OK) |
| `aiEscalationKeywords` | String[] JSON | see below | Customer message contains → escalate, no send |

**Default escalation keywords** (case-insensitive substring match on inbound text):

`["แอดมิน","คุยกับคน","โทรหา","ติดต่อเจ้าหน้าที่","ขอคุยกับคน","พูดกับคน","ฝ่ายบริการ","โทร"]`

Tenant may override via settings UI (comma-separated). Empty list = no keyword escalation.

```prisma
enum AiAutoReplyMode {
  OFF              // same as enable false
  WHEN_UNASSIGNED  // skip if conversation assigned to agent
  ALWAYS           // every inbound text (dangerous; OWNER only)
  OFF_HOURS_ONLY   // default — AI fires **outside** business hours only
}
```

**Off-hours semantics** (same as automation `OFF_HOURS` trigger): use tenant `timezone` (default `Asia/Bangkok`). AI auto-reply runs when current local hour is **outside** `[aiAutoReplyBusinessHourStart, aiAutoReplyBusinessHourEnd)`. Example: start=8, end=23 → AI active **00:00–07:59** only.

### `AuditAction` (migration)

- `AI_AUTO_REPLY_SENT`
- `AI_AUTO_REPLY_SKIPPED` (metadata: reason code)
- `AI_AUTO_REPLY_ESCALATED`
- `AI_AUTO_REPLY_FAILED`

### Conversation (optional v1.1)

- Tag `ai-escalated` applied on escalation (reuse tag system)

No new tables for v1.

---

## Guards (all must pass before LLM call)

| Guard | Skip reason code |
|-------|------------------|
| `enableAiAutoReply === false` | `disabled` |
| Inbound not TEXT or empty | `non_text` |
| `aiAutoReplyMode` + assignment/hours | `mode_blocked` |
| Escalation keyword in message | `escalated` → tag + optional HIGH priority |
| Redis rate limit (e.g. 5/conv/hour, 200/tenant/day) | `rate_limited` |
| `assertAiCreditAvailable` fails | `no_credits` |
| LLM 429 / not configured | `provider_unavailable` — optional knowledge-only send (see risk) |
| Outbound message sent in last 3s on same conversation | `debounce` — avoid double reply with automation |

**v1 default mode:** `OFF_HOURS_ONLY` — AI replies only outside configured business hours (default 08:00–23:00 Bangkok window = night/early-morning coverage). Other modes selectable in settings.

---

## Generation

Reuse from `aiSuggest`:

- Last 15 messages, customer profile, tags, notes  
- `KnowledgeService.buildKnowledgeContext()` hybrid RAG  
- Scenario instructions when matched (read-only, no duplicate scenario actions)  
- `aiAgentGender`, `aiProvider`, tenant instructions  
- Post-process: trim, max 5000 chars (LINE limit), strip markdown if needed  

**Do not** create `AiSuggestion` row for auto-reply in v1 (separate audit action). Optional v1.1 link suggestion id.

---

## API / UI

### Settings (`PATCH /api/v1/tenants/me/settings` or existing AI settings endpoint)

- Toggle **เปิด AI ตอบแชทอัตโนมัติ** (warning copy: ทดสอบ knowledge ก่อน)  
- Mode select  
- Escalation keywords (comma-separated)  
- Extra instructions textarea  
- Show daily credit usage / remaining (existing usage hook)

### Inbox

- Badge on conversation: **AI ตอบอัตโนมัติ** when last outbound was `triggeredBy: system` auto-reply  
- No composer change required for v1

---

## Prerequisites (Track 4 — ops, no code)

Before enabling in production for customer tenant:

1. **Gemini billing** or paid API key — free 20 req/day not enough for auto-reply  
2. **Re-index all** knowledge documents after embedding model stable  
3. Smoke test: 10 real FAQ questions → verify citations in reply  
4. Render plan ≥ starter if webhook volume grows  

Document in `docs/deployment/ai-auto-reply-ops.md` (created with implementation).

---

## Automation polish (Track 3 — parallel)

Already partially done:

- [x] `skipRuleIds` on resume (dedupe same rule on resume message)

Still todo:

- [x] `WAITING_FOR_REPLY` timeout (e.g. 24h → run `FAILED` or send reminder step)  
- [x] Rule template presets in UI (off-hours welcome, FAQ handoff)  
- [x] OFF_HOURS hint (done)

---

## Out of scope (v1)

- Automation step `AI_AUTO_REPLY` (Phase F-beta)  
- Confidence score gating  
- Multi-language auto-detect  
- AI-initiated proactive messages  
- Billing credit deduction beyond existing `assertAiCreditAvailable`  
- pgvector / OpenSearch  

---

## Risks

| Risk | Mitigation |
|------|------------|
| Wrong/hallucinated answer | RAG-first prompt; escalation keywords; default OFF_HOURS_ONLY limits exposure |
| Double reply (automation + AI) | 3s debounce; document: disable overlapping automation text steps |
| Gemini quota | Paid key + rate limits + skip with audit |
| Customer expects 100% human-free | Copy in UI: escalation + assign still available |
| Legal/compliance | Audit every send; OWNER enables explicitly |

---

## Success criteria

- [ ] OWNER enables auto-reply → customer LINE message gets AI reply within 10s without admin action *(staging smoke)*  
- [x] Escalation keyword → no AI send, tag/audit `escalated`  
- [x] Outside business hours → AI replies; inside hours → silent (`OFF_HOURS_ONLY` default)  
- [x] `WHEN_UNASSIGNED` mode → assigned conversation silent  
- [x] Credits exhausted → skip + audit, no crash  
- [x] All sends tenant-scoped + audited  
- [x] Tests: guards unit + webhook integration mock  
- [x] Inbox badge when last outbound is AI auto-reply (`triggeredBy: system`)  

---

## Approval

- [x] Approach A — Webhook Auto-Reply  
- [x] Default OFF, **OFF_HOURS_ONLY** mode (business hours 8–23 Bangkok)  
- [x] Expanded escalation keyword defaults (Thai CS phrases)  
- [x] Include Track 3 polish + Track 4 ops in same program  
- [x] Founder approved spec → Wave 1 implementation in progress  
