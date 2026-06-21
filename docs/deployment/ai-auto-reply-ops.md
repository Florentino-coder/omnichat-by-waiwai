# AI Auto-Reply — Ops & Staging Guide

**Date:** 2026-06-22  
**Phase:** F-alpha (webhook AI auto-reply)  
**Spec:** `docs/superpowers/specs/2026-06-22-phase-f-alpha-ai-auto-reply-design.md`  
**Feature summary:** `docs/superpowers/specs/2026-06-22-phase-f-alpha-implementation-summary.md`

Use this checklist before enabling **AI ตอบแชทอัตโนมัติ** on a customer tenant. Default is **OFF** — founder must explicitly enable.

---

## Prerequisites

| Item | Why |
|------|-----|
| Phase D RAG deployed | Auto-reply uses same hybrid knowledge context as manual AI suggest |
| Migration `20260622200000_add_ai_auto_reply_settings` applied | Tenant settings columns + audit enums |
| Gemini **billing enabled** or paid API key | Free tier (~20 req/day) is not enough for auto-reply volume |
| Knowledge documents indexed (`READY`) | Wrong/empty RAG → bad answers |
| Redis reachable | Rate limits, debounce, auth refresh tokens |
| Render API ≥ Starter (recommended) | Cold starts on free tier can exceed 10s webhook budget |

Related deploy baseline: `docs/deployment/free-mvp-deploy.md`, `docs/deployment/infra-db-safety-checkpoint.md`.

---

## Environment variables (API)

Set on Render / Coolify secrets (same runtime as NestJS API):

```bash
# LLM (required for auto-reply)
GEMINI_API_KEY="<google-ai-api-key-with-billing>"
LLM_PROVIDER="gemini"
GEMINI_MODEL="gemini-2.5-flash"

# Embeddings (knowledge re-index)
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"   # optional; default shown

# Core infra (required)
DATABASE_URL="<postgres-transaction-pooler>"
DIRECT_URL="<postgres-direct-or-session>"
REDIS_URL="<redis-url>"
JWT_SECRET="<strong-secret>"
JWT_REFRESH_SECRET="<strong-secret>"
ENCRYPTION_KEY="<32-byte-base64>"               # LINE tokens depend on this

# Web (Vercel)
NEXT_PUBLIC_API_BASE_URL="https://<api-host>"
```

Optional alternates: `OPENAI_API_KEY` / `CLAUDE_API_KEY` with matching `LLM_PROVIDER` — tenant `aiProvider` setting overrides env default.

Verify provider health: SuperAdmin → `/super-admin/ai` (key configured, model name).

See also: `docs/prd/ai-launch-checklist.md` (manual AI suggest path).

---

## Deploy steps

1. Merge F-alpha code to target branch; confirm CI green (`api:test`, `api:typecheck`, `web:typecheck`).
2. Deploy API — build runs `prisma migrate deploy` (includes AI auto-reply settings).
3. Deploy web (Vercel).
4. Confirm health:

   ```bash
   curl https://<api-host>/api/v1/health
   ```

   Expected: `success: true`, DB + Redis up.

5. Confirm LINE webhook URL still valid:

   ```text
   https://<api-host>/api/v1/line/webhook/<lineChannelId>
   ```

---

## Knowledge re-index checklist

Do this **before** enabling auto-reply on a tenant.

1. Login as **OWNER** or **ADMIN**.
2. Open **Settings → Knowledge**.
3. Confirm documents show status **READY** (not `PENDING` / `FAILED`).
4. Click **Re-index ทั้งหมด** (calls `POST /api/v1/knowledge/documents/reindex`).
5. Wait until all docs return to **READY** (large corpora may take several minutes).
6. Spot-check 5–10 FAQ questions with **Settings → AI → Test AI** (`POST /api/v1/inbox/ai-test`):
   - Thai polite particles match tenant persona
   - Answers cite knowledge (not hallucinated product facts)
   - Escalation phrases in test input are **not** sent as auto-reply (keyword guard)

Re-index again after: embedding model change, bulk doc upload, or major FAQ edits.

---

## Enable auto-reply (tenant)

**Role:** `ADMIN` required for `PATCH /api/v1/inbox/settings`. `OWNER` can run AI Test.

1. **Settings → AI**
2. Review **AI credit usage** (`used / limit`) — must be > 0 remaining.
3. Configure (optional before toggle):
   - **Mode** — default `OFF_HOURS_ONLY` (AI only outside 08:00–23:00 Bangkok)
   - **Business hours** — start/end hour (tenant timezone, default `Asia/Bangkok`)
   - **Escalation keywords** — comma-separated Thai phrases; default list pre-filled
   - **Extra instructions** — tenant-specific system prompt addendum
4. Turn on **เปิด AI ตอบแชทอัตโนมัติ** (`enableAiAutoReply: true`).
5. Save settings.

**Warning copy in UI:** Re-index Knowledge and run AI Test before enabling.

### Mode reference

| Mode | Behavior |
|------|----------|
| `OFF_HOURS_ONLY` (default) | Reply only **outside** `[start, end)` local hours |
| `WHEN_UNASSIGNED` | Skip if conversation assigned to agent |
| `ALWAYS` | Every inbound text (use staging only until dogfooded) |
| `OFF` | Same as toggle off |

---

## Staging smoke — real LINE reply < 10s

Run on **staging tenant + staging LINE OA** before customer production.

### Setup

- [ ] API + web deployed with F-alpha migration
- [ ] `GEMINI_API_KEY` with billing; quota healthy
- [ ] Knowledge re-index complete; AI Test passes
- [ ] LINE webhook verified; inbound messages appear in inbox
- [ ] Auto-reply toggle **ON**
- [ ] No overlapping automation rule that sends fixed text on same trigger (avoid double reply; 3s debounce helps but does not replace rule design)

### Trigger auto-reply during business hours (staging only)

Default mode `OFF_HOURS_ONLY` is **silent** during 08:00–22:59 Bangkok. For daytime staging smoke, pick one:

- **Option A (recommended):** Set mode to `WHEN_UNASSIGNED` or `ALWAYS` on staging tenant only.
- **Option B:** Temporarily set business hours so current local hour is **outside** the window (e.g. start=8, end=8 → always off-hours).
- **Option C:** Run smoke between 23:00–07:59 Bangkok.

Revert mode/hours after smoke.

### Test procedure

1. Note timestamp `T0`.
2. From a **customer LINE account**, send plain text FAQ (e.g. "เปิดกี่โมง" / "ราคาเท่าไหร่") — **no** escalation keyword.
3. Within **10 seconds**, customer receives AI reply on LINE.
4. In **Inbox**:
   - [ ] Outbound message in thread
   - [ ] Badge **AI ตอบอัตโนมัติ** on conversation list + header (last outbound `triggeredBy: system`)
5. **Audit log** (DB or future UI): `AI_AUTO_REPLY_SENT` with `tenantId`, `conversationId`.
6. **Negative tests:**
   - Send message containing `แอดมิน` → no AI send; tag `ai-escalated`; audit `AI_AUTO_REPLY_ESCALATED`
   - Send 6 messages in 1 hour same conv → 6th skipped; audit `AI_AUTO_REPLY_SKIPPED` reason `rate_limited`
   - During business hours with `OFF_HOURS_ONLY` → no send; audit `mode_blocked`

### Pass criteria

- [ ] FAQ reply on LINE in **< 10s** without admin action
- [ ] Escalation keyword blocked
- [ ] Rate limit + mode guards behave as expected
- [ ] No duplicate reply from automation + AI on same inbound

Mark spec success criterion complete after staging sign-off.

---

## Monitoring & audit

| Audit action | Meaning |
|--------------|---------|
| `AI_AUTO_REPLY_SENT` | LLM reply pushed to LINE |
| `AI_AUTO_REPLY_SKIPPED` | Guard failed; metadata includes `reason` |
| `AI_AUTO_REPLY_ESCALATED` | Escalation keyword; tag `ai-escalated` applied |
| `AI_AUTO_REPLY_FAILED` | LLM/provider error or send failure |

Skip reason codes: `disabled`, `non_text`, `mode_blocked`, `escalated`, `debounce`, `no_credits`, `rate_limited`, `provider_unavailable`.

**Rate limits (Redis):**

- 5 replies / conversation / hour (`ai-auto-reply:conv:{id}`)
- 200 replies / tenant / day (`ai-auto-reply:tenant:{id}`)

**Debounce:** 3s — skips if any outbound on conversation in last 3s (automation + AI overlap).

SuperAdmin: `/super-admin/ai` for provider health and usage trends.

---

## Rollback

1. **Immediate:** Settings → AI → turn off **เปิด AI ตอบแชทอัตโนมัติ** (API blocks on next inbound).
2. **Quota emergency:** Set tenant plan `maxAiCreditsPerMonth = 0` or rotate/remove `GEMINI_API_KEY`.
3. **Deploy rollback:** Revert API/web to pre-F-alpha release (migration is additive — safe to run old code with new columns).
4. **Automation overlap:** Disable conflicting automation rules sending fixed text on `MESSAGE_RECEIVED`.

---

## Automation polish (Track 3 — shipped with F-alpha)

- `WAITING_FOR_REPLY` runs older than **24h** → hourly cron marks `FAILED` + `AUTOMATION_RUN_FAILED` audit.
- Rule templates in Settings → Automation: **Off-hours welcome**, **FAQ handoff**.
- Webhook resume passes `skipRuleIds` to avoid duplicate rule fire on customer reply.

---

## References

- Implementation summary (all waves): `docs/superpowers/specs/2026-06-22-phase-f-alpha-implementation-summary.md`
- Plan: `docs/superpowers/plans/2026-06-22-phase-f-alpha-ai-auto-reply-plan.md`
- AI launch (manual suggest): `docs/prd/ai-launch-checklist.md`

_Last updated: 2026-06-22 — Wave 0 ops doc_
