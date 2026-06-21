# Phase C.2 + D.3 — Automation v2 (Dual Mode) & RAG Hardening

Date: 2026-06-21  
Status: Approved (2026-06-21)  
Depends on: Phase C Automation v1, Phase D.2+ RAG

---

## Context

### Gemini 429 (confirmed)

Free tier `gemini-2.5-flash` limit: **20 generate requests / day / project / model**.

Log `GenerateRequestsPerDayPerProjectPerModel-FreeTier` + `quotaValue: 20` = daily quota exhausted, not per-minute burst.

**Impact today**

- `AI ร่างคำตอบ` → `502 Bad Gateway` (backend maps LLM failure to gateway error)
- RAG **retrieval** still works (embedding uses separate quota; may also hit limits under heavy re-index)
- Automation LINE replies **unaffected** (no Gemini)

**Ops (no code)**

- Wait until UTC quota reset, or enable billing on Google AI project, or switch `GEMINI_MODEL` / add paid key
- Monitor: https://ai.dev/rate-limit

---

## Part A — Automation v2 (Dual Execution Mode)

### Problem

v1 runs all steps **immediately** after trigger. Founders expect:

1. **Instant chain** — off-hours double message, tag + assign in one go
2. **Reply-driven** — ask question → wait customer → ask next (CS script flow)

Both are valid. v1 only supports (1).

### Goal

Support **both modes in one rule** without breaking existing rules.

### Approach (recommended): per-step `runAfter`

Add optional field on steps **index ≥ 1**:

```typescript
type StepRunAfter = "immediate" | "customer_reply"; // default: immediate

// Example step
{
  "type": "SEND_TEXT_REPLY",
  "text": "แจ้งเบอร์",
  "runAfter": "customer_reply"
}
```

**Semantics**

| `runAfter` | Behavior |
|------------|----------|
| `immediate` (default) | Run right after previous step finishes (v1) |
| `customer_reply` | Pause run until **next inbound customer message** on same conversation, then run this step |

Step 0 always runs on trigger (ignores `runAfter`).

**Alternative rejected:** rule-level single mode — too coarse; cannot mix instant + reply in one script.

**Alternative rejected:** separate rules only — works but hard to maintain; user already confused.

### Runtime

1. Trigger → create run → enqueue step 0
2. After step N completes:
   - If step N+1 has `runAfter: customer_reply` → set run `status = WAITING_FOR_REPLY`, `currentStepIndex = N+1`, **do not enqueue yet**
   - Else → enqueue step N+1 immediately (v1)
3. On `MESSAGE_RECEIVED` (LINE webhook, inbound only):
   - **Before** matching new rules: find runs where `conversationId` + `status = WAITING_FOR_REPLY` + enabled rule
   - Resume **one** run (lowest rule priority number first; tie-break by `createdAt`)
   - Execute waiting step; continue chain per `runAfter` on following steps
4. Outbound automation messages must **not** resume waiting runs

### Data model

```prisma
enum AutomationRunStatus {
  PENDING
  RUNNING
  WAITING          // existing — used for WAIT delay seconds
  WAITING_FOR_REPLY // NEW
  COMPLETED
  FAILED
}
```

No schema change to `AutomationRule.steps` JSON shape beyond new optional `runAfter` key (validated in parser).

Optional `AutomationRun.context` JSON:

```json
{ "pausedAt": "ISO", "resumeReason": "customer_message", "messageId": "..." }
```

### API / Parser

- Extend `automation-step.parser.ts` — accept `runAfter` on steps 2+
- Invalid on step 0 → `400 Bad Request`
- Default missing `runAfter` → `immediate` (backward compatible)

### UI (Settings → Automation)

- Under step 2+, checkbox: **「รอลูกค้าตอบก่อนขั้นตอนนี้」** / “Wait for customer reply before this step”
- Section hint (already added in v1.1 copy): explain instant vs reply-driven
- List view badge: `reply-driven` if any step uses `customer_reply`

### Audit

Reuse `AUTOMATION_STEP_EXECUTED`, `AUTOMATION_RUN_*`. Add metadata `runAfter`, `resumeReason` where useful.

No new `AuditAction` unless required — prefer metadata on existing actions.

### Edge cases

| Case | Behavior |
|------|----------|
| Customer sends 3 messages while paused | Resume **once**; extra messages can trigger **other** rules normally |
| Two rules paused on same conversation | Resume highest-priority rule first; others stay paused |
| Rule disabled while paused | Skip resume; mark run `FAILED` or `COMPLETED` with note |
| WAIT step then customer_reply step | WAIT delay first, then pause for reply |
| Same inbound message triggers rule + resume | Process resume **first**, then evaluate new triggers on **same** message (configurable; default: resume only, skip duplicate rule fire for same rule) |

### Tests

- Unit: parser defaults + validation
- Unit: engine — 2 steps, second `customer_reply`, resume on inbound
- Unit: engine — instant chain unchanged (regression)
- Integration: webhook → pause → second message → second reply sent

### Out of scope (Phase E/F)

- Visual flow canvas
- Timeout / auto-close if no reply in N hours
- AI steps (`AI_SUGGEST`, `AI_AUTO_REPLY`)

---

## Part B — RAG Hardening (D.3)

### Problem

D.2+ shipped ingest + citations, but production gaps remain:

1. Documents indexed with old embedding model need **re-index**
2. Gemini **429** breaks AI suggest UX (502 in browser)
3. No bulk re-index or ingest health visibility in UI

### Goal

Make RAG + AI suggest **usable under real quota limits** and easy to recover after model changes.

### Scope (In)

#### B.1 — Re-index API

```
POST /api/v1/knowledge/documents/reindex
Body: { documentIds?: string[], lineChannelId?: string, all?: boolean }
```

- OWNER/ADMIN only
- Sets selected docs `PENDING` → enqueue ingest jobs (respect `KNOWLEDGE_INGEST_QUEUE_MODE`)
- Audit: `KNOWLEDGE_DOCUMENT_REINDEX_REQUESTED` (new enum value)

#### B.2 — Re-index UI

- Knowledge settings: **Re-index all** + per-document **Re-index** button
- Show last indexed time + status (`READY` / `PENDING` / `FAILED`)

#### B.3 — AI suggest error UX

Backend (already partially there):

- Return `422` or `429` with code `AI_PROVIDER_RATE_LIMITED` instead of opaque `502` when quota hit

Frontend:

- Map codes to Thai messages:
  - `AI_PROVIDER_RATE_LIMITED` → “โควตา AI วันนี้เต็มแล้ว ลองพรุ่งนี้หรืออัปเกรด API”
  - `AI_PROVIDER_NOT_CONFIGURED` → setup hint
- Disable “AI ร่างคำตอบ” button when tenant daily limit known exhausted (optional v2)

#### B.4 — RAG fallback when LLM unavailable (lightweight)

When suggest fails with rate limit / provider error:

- If hybrid context has citations → return `{ mode: "knowledge_only", excerpts: citations[], suggestedText: null }`
- Agent can copy from excerpts manually
- **Does not** call Gemini again

#### B.5 — Embedding quota guard

- Catch embedding 429 in ingest job → doc `FAILED` with message, retry later
- Log clearly; do not spin forever

### Scope (Out)

- pgvector migration (Stage 13)
- OpenSearch
- Billing credit deduction (Stage 17)
- Auto-switch model when 429 (too magic for MVP)

### Success criteria

- [ ] Re-index all docs after embedding model change in one click
- [ ] AI suggest shows readable Thai error, not raw 502
- [ ] Knowledge-only fallback returns citations when LLM down
- [ ] Automation reply-driven flow works end-to-end in dogfood

---

## Implementation order

| Order | Track | Why |
|-------|-------|-----|
| 1 | D.3 B.3 | Quick win — fixes screenshot 502 confusion |
| 2 | D.3 B.1 + B.2 | Re-index after embedding fix |
| 3 | C.2 engine + webhook resume | Core automation v2 |
| 4 | C.2 UI | Founder configures flows |
| 5 | D.3 B.4 + B.5 | Resilience |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Resume + new rule double-fire | Resume first; dedupe same rule on same message |
| Free Gemini too low for dogfood | Paid key or lower suggest frequency |
| Inline queue deep recursion many steps | Keep max 20 steps; reply mode breaks chain across messages |

---

## Approval checklist

Founder confirm:

- [ ] Per-step `runAfter` approach OK (vs rule-level mode)
- [ ] Resume priority: highest-priority paused rule first
- [ ] D.3 scope OK; pgvector still deferred
- [ ] Proceed to implementation plan (`writing-plans`)
