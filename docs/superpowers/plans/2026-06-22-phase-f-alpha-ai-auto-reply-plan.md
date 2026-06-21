# Phase F-alpha + Polish (3) + RAG Ops (4) — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Ship webhook AI auto-reply (Approach A approved) plus automation polish and RAG ops readiness.

**Spec:** `docs/superpowers/specs/2026-06-22-phase-f-alpha-ai-auto-reply-design.md`

**Architecture:** Extract `AiReplyGeneratorService` from `InboxService.aiSuggest`; new `AiAutoReplyService` called from `LineWebhookService` after automation dispatch; tenant settings flags; audit + credit guards.

---

## Wave 0 — RAG ops readiness (Track 4)

No feature code required; founder/ops tasks + one doc.

| Step | Action |
|------|--------|
| 0.1 | Create `docs/deployment/ai-auto-reply-ops.md` — Gemini billing, env vars, re-index checklist ✅ |
| 0.2 | Production: enable Google AI billing or dedicated API key |
| 0.3 | Settings → Knowledge → **Re-index all** for customer tenant |
| 0.4 | Manual smoke: 10 FAQ questions via AI suggest before enabling auto-reply |

**Exit:** Knowledge docs `READY`, Gemini quota > 1000/day or billing on.

---

## Wave 1 — Shared AI reply generator

| File | Change |
|------|--------|
| `apps/api/src/ai/ai-reply-generator.service.ts` | NEW — extract prompt build + LLM call from `inbox.service.ts` |
| `apps/api/src/inbox/inbox.service.ts` | Delegate `aiSuggest` generate path to generator |
| `apps/api/src/ai/ai.module.ts` | NEW — export generator |
| `apps/api/src/inbox/inbox.service.spec.ts` | Regression tests pass |

- [ ] Step 1: Test — generator returns same shape as current suggest text path  
- [ ] Step 2: Extract without behavior change  
- [ ] Step 3: `npm run api:test -- inbox.service.spec` PASS  

---

## Wave 2 — Schema + settings API

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `enableAiAutoReply`, `aiAutoReplyMode`, `aiAutoReplyBusinessHourStart` (8), `aiAutoReplyBusinessHourEnd` (23), `aiAutoReplyInstructions`, `aiEscalationKeywords`; enum `AiAutoReplyMode`; audit enums |
| Migration | idempotent pattern |
| `apps/api/src/inbox/dto/update-inbox-settings.dto.ts` | New fields |
| `apps/api/src/inbox/inbox.service.ts` | Persist + audit `INBOX_SETTINGS_UPDATED` |
| `apps/api/src/ai/ai-auto-reply.constants.ts` | Defaults + keyword normalization |
| `apps/web/app/app/settings/ai-settings.tsx` | Toggle, mode, business hours, keywords, instructions + warning copy |
| `apps/web/app/lib/i18n.ts` | Thai + English strings |

- [x] Default `enableAiAutoReply: false`, `aiAutoReplyMode: OFF_HOURS_ONLY`  
- [x] Default escalation keywords: `["แอดมิน","คุยกับคน","โทรหา","ติดต่อเจ้าหน้าที่","ขอคุยกับคน","พูดกับคน","ฝ่ายบริการ","โทร"]`  
- [x] Tests for settings PATCH validation  

---

## Wave 3 — AiAutoReplyService + webhook

| File | Change |
|------|--------|
| `apps/api/src/ai/ai-auto-reply.service.ts` | NEW — guards, escalate, generate, send |
| `apps/api/src/line/line-webhook.service.ts` | Call after automation dispatch (text only) |
| `apps/api/src/line/line.module.ts` | Import AiModule |
| `apps/api/src/ai/ai-auto-reply.service.spec.ts` | Unit tests all skip reasons |
| `apps/api/src/line/line-webhook.service.spec.ts` | Mock auto-reply invoked |

Guard order: disabled → non_text → mode → escalation → debounce → credits → rate → generate → send.

Send via `LineReplyService.replyText(tenantId, "system", ...)`.

- [x] Audit `AI_AUTO_REPLY_*` actions  
- [x] Redis rate keys: `ai-auto-reply:conv:{id}` TTL 1h, `ai-auto-reply:tenant:{id}` TTL 24h  

---

## Wave 4 — Automation polish (Track 3)

| File | Change |
|------|--------|
| `apps/api/src/automation/automation.service.ts` | Cron or queue job: `WAITING_FOR_REPLY` older than 24h → `FAILED` + audit |
| `apps/web/app/app/settings/automation-manager.tsx` | Optional: 2 rule templates (off-hours welcome, FAQ) |
| Verify | `skipRuleIds` dedupe already in webhook — add test if missing |

- [x] Test timeout job  
- [x] i18n template labels  

---

## Wave 5 — Inbox UX + verification

| File | Change |
|------|--------|
| `apps/web/app/app/inbox/inbox-client.tsx` | Optional badge when last outbound metadata `triggeredBy: system` |
| `apps/api/src/line/line-reply.service.ts` | Store `omnichatMeta.triggeredBy` on system outbound messages |
| Docs | Update spec success criteria checkboxes |

- [x] Inbox list + thread header AI auto-reply badge  
- [x] Outbound metadata for system sends  

```bash
npm run api:test
npm run api:typecheck
npm run web:typecheck
```

Production: resolve migration → deploy → enable toggle in staging first → customer tenant.

---

## Execution order

```
Wave 0 (ops) ── parallel ── Wave 1 (extract generator)
         ↓
Wave 2 (settings) → Wave 3 (auto-reply) → Wave 4 (polish) → Wave 5 (UX)
```

Estimated: **5 waves**, ~3–5 days focused work.

---

## Roadmap placement

| Phase | Name | Status |
|-------|------|--------|
| C.2 + D.3 | Automation v2 + RAG hardening | Done |
| **F-alpha** | **AI Auto-Reply MVP (this plan)** | **Next** |
| F-beta | Automation `AI_AUTO_REPLY` step | After F-alpha dogfood |
| Stage 6 | Reporting Lite | After dogfood gate |
| Stage 15–16 | Hybrid / Full agent | Post-MVP |

---

## After this plan

1. Dogfood auto-reply 1–2 weeks on one LINE channel  
2. Fix P0/P1 (wrong answers, double replies, quota)  
3. Then Stage 6 Reporting or F-beta automation AI step  
