# AI Launch Checklist

Use this checklist before enabling AI Suggested Reply for production tenants.

## Environment

- [ ] `GEMINI_API_KEY` (or `OPENAI_API_KEY` / `CLAUDE_API_KEY`) set in API runtime secrets
- [ ] `LLM_PROVIDER` matches the configured key (`gemini` | `openai` | `claude`)
- [ ] `GEMINI_MODEL` / provider model env set to intended default
- [ ] `ENCRYPTION_KEY` is 32-byte base64 and unchanged across deploys (LINE tokens depend on it)
- [ ] `DATABASE_URL` / `DIRECT_URL` point to production DB
- [ ] `REDIS_URL` reachable (rate limits + refresh tokens)
- [ ] Web `NEXT_PUBLIC_API_BASE_URL` points to production API

## Database

- [ ] `prisma migrate deploy` applied (includes `ai_suggestions` telemetry columns)
- [ ] `plan_limits.max_ai_credits_per_month` > 0 for plans that should use AI
- [ ] Seed / manual SQL verified for `suggested_reply_default` prompt template per tenant
- [ ] Conversations linked to `customers` (AI suggest returns 404 without customer)

## Functional smoke (manual)

- [ ] Login → Inbox → open conversation with inbound message
- [ ] Send agent reply → message appears in thread + conversation preview updates
- [ ] Settings → AI → usage widget shows `used / limit` (not `0 / 0` unless plan excludes AI)
- [ ] Settings → AI → **Test AI** returns Thai reply with expected polite particles
- [ ] Inbox → **AI ร่างคำตอบ** fills composer within ~15s
- [ ] Edit suggestion → send → audit log contains `AI_SUGGEST_GENERATED`, `AI_SUGGEST_EDITED`, `AI_SUGGEST_SENT`

## Automated verification

```bash
npm run api:test:e2e -- ai-launch.e2e-spec.ts
npm run api:test -- --testPathPattern=inbox.service.spec
npm run web:typecheck
```

## SuperAdmin monitor

- [ ] `/super-admin/ai` loads for SuperOwner
- [ ] Provider health shows key configured
- [ ] Stats update after at least one AI suggest/test call

## Rollback plan

- [ ] Disable tenant AI: Settings → turn off `enableAiSuggest` (API blocks immediately)
- [ ] Platform kill switch: set tenant plan `maxAiCreditsPerMonth = 0` or move tenant to `free` plan without AI quota
- [ ] Remove/rotate LLM API key if provider billing issue
- [ ] Revert deploy via Coolify previous release tag

## Dogfooding gate

- [ ] Internal team uses inbox + AI daily for 1 week
- [ ] No P0 inbox sync bugs open
- [ ] No unresolved AI quota false positives (`PLAN_EXCLUDES_AI` vs `MONTHLY_LIMIT_REACHED`)

_Last updated: 2026-06-21 — Phase 4 launch verification_
