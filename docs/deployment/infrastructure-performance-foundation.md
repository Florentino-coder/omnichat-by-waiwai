# Infrastructure + Performance Foundation

**Date:** 2026-06-15
**Source:** Local founder guide `omnichat-infrastructure-guide.md`
**Mode:** Foundation first, no shared-DB writes

This checkpoint normalizes the local infrastructure blueprint into repo-safe execution order. Do not start Stage 4A CRM until this foundation gate is closed or explicitly waived.

## Foundation Gate

### P0 - Production Safety

- Rotate the exposed Supabase database password before any production or dogfooding use.
- Store rotated secrets only in Render, Coolify, Vercel, Upstash, local untracked `.env`, or a password manager.
- Use Supabase transaction pooler on port `6543` for runtime `DATABASE_URL`.
- Use Supabase direct or session URL for Prisma-only `DIRECT_URL`.
- Upgrade Render API to Starter or equivalent always-on plan before pointing a real production LINE webhook at OmniChat.

### P1 - Capacity Baseline

- Supabase Pro is required when Free connection/storage/advisor limits are hit.
- Upstash Pay-as-you-go is required before Redis quota affects auth, session, queue, or webhook behavior.
- Vercel Pro is not a blocker for MVP smoke, but becomes required before larger team usage or production traffic expectations exceed Hobby limits.

### P2 - Performance Baseline

- Keep tenant-scoped reads paginated.
- Avoid N+1 Prisma reads in inbox and future CRM views.
- Add composite indexes through reviewed Prisma migrations only; do not run ad-hoc `CREATE INDEX` against shared Supabase.
- Defer BullMQ, SSE, storage upload, and major inbox UI redesign into approved implementation plans because they require dependency, architecture, or UX review.

## Current Repo Status

| Item | Status | Evidence |
|---|---|---|
| Prisma `directUrl` | Done | `prisma/schema.prisma` uses `directUrl = env("DIRECT_URL")`. |
| Runtime/migration URL separation | Done | `docs/deployment/infra-db-safety-checkpoint.md` and `render.yaml`. |
| Render Free warning | Done | `render.yaml` and deployment docs mark Free as MVP smoke only. |
| Secret-safe env templates | Done | Repo docs use placeholders only. |
| Read-only Supabase verification | Done | `docs/deployment/infra-db-safety-checkpoint.md`. |
| Composite index review | Pending | Needs local/disposable DB migration plan, not shared Supabase SQL. |
| Upstash quota decision | Pending | Check provider usage before dogfooding. |
| Render paid upgrade | Manual | Founder/provider action. |

## Execution Order

1. Merge the Infra + DB Safety Checkpoint PR.
2. Rotate Supabase database password.
3. Update provider secrets with rotated values:
   - Render/Coolify `DATABASE_URL`
   - Render/Coolify `DIRECT_URL`
   - Local untracked `.env`
4. Upgrade Render API plan to Starter or equivalent.
5. Check Upstash Redis usage and switch to Pay-as-you-go if quota risk exists.
6. Run read-only DB verification from `docs/deployment/infra-db-safety-checkpoint.md`.
7. Run production smoke:
   - `/api/v1/health`
   - login
   - LINE settings save
   - LINE webhook verify
   - inbound LINE message appears in inbox
   - inbox reply sends to LINE
8. Only then open Stage 4A CRM implementation.

## Index Review Rule

The founder guide includes raw SQL index examples. In this repo, indexes must be represented in Prisma schema and shipped through a reviewed migration. Existing table and column names use Prisma's mapped names, so do not copy raw guide SQL blindly.

Safe review checks are `SELECT` only:

```sql
select
  t.tablename,
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = t.schemaname
      and i.tablename = t.tablename
      and i.indexdef ilike '%tenantId%'
  ) as has_tenant_index
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;
```

Candidate composite indexes must be planned against actual Prisma models before migration:

- `Message`: tenant, conversation, created time lookup.
- `Conversation`: tenant, status, last message/update ordering.
- `Conversation`: tenant, assignee, status lookup.
- `LineChannel`: tenant and LINE channel lookup.

## Deferred Work

These items are useful but not part of this foundation gate:

- BullMQ webhook processor. Requires dependency approval and queue design.
- SSE/Redis Pub/Sub realtime. Requires connection lifecycle and auth design.
- Supabase Storage media upload. Requires storage policy, upload validation, and LINE media send design.
- Premium inbox redesign. Requires frontend spec/plan and screenshot verification.
- React Server Component refactor for inbox. Requires route/data-flow plan to avoid breaking current authenticated client API flow.
