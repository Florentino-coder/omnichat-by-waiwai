# Infra + DB Safety Checkpoint

**Date:** 2026-06-15
**Target:** Supabase PostgreSQL + Render/Vercel deploy safety
**Mode:** Read-only verification only

## P0 Secret Rotation

A Supabase PostgreSQL connection string was pasted into chat. Treat the database password as exposed.

Required manual action before production use:

1. Rotate the database password in Supabase.
2. Update only secret stores: Render, Coolify, local untracked `.env`, and any password manager entry.
3. Do not commit real connection strings, passwords, API keys, channel secrets, or access tokens.
4. If the new password contains reserved URL characters such as `#`, encode it in connection URLs.

## Environment Template

Use placeholders only in repo files.

```bash
# Runtime application queries. Use Supabase transaction pooler.
DATABASE_URL="postgresql://postgres.<project-ref>:<url-encoded-password>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Prisma migrations/status. Use direct or session-pooler URL according to the deployment target.
DIRECT_URL="postgresql://postgres:<url-encoded-password>@db.<project-ref>.supabase.co:5432/postgres"
```

Rules:

- `DATABASE_URL` is for normal NestJS/Prisma runtime traffic.
- `DIRECT_URL` is for Prisma migration/session operations only.
- Never run destructive test fixtures against shared Supabase.
- Never run `prisma migrate dev`, seed, or e2e reset flows against a non-disposable database.

## Read-Only Verification

Run only after password rotation and after confirming the DB target is not disposable.

```powershell
$env:DATABASE_URL="<rotated-supabase-transaction-pooler-url>"
$env:DIRECT_URL="<rotated-supabase-direct-or-session-url>"
npm run prisma:validate
npx prisma migrate status
```

Allowed SQL checks are `SELECT` only:

```sql
-- Table inventory and RLS status.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Tenant index coverage for tenant-scoped tables.
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

-- Data API grants visibility. This is informational only.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
```

Forbidden on shared Supabase during this checkpoint:

- `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`
- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db seed`
- `npm run api:test:e2e`
- DB-backed integration tests that reset tenant, user, workspace, LINE, conversation, message, or audit tables

## Supabase Data API Note

Supabase announced that new `public` tables are no longer automatically exposed to the Data API/GraphQL for new projects from May 30, 2026, and the behavior is enforced for existing projects on October 30, 2026. RLS is unchanged; explicit grants decide whether PostgREST/GraphQL can see a table.

OmniChat currently uses NestJS + Prisma through PostgreSQL connection strings, so this change does not affect normal server-side Prisma reads/writes. If a future frontend or worker uses Supabase Data API, new tables must add explicit grants and RLS policies in the same migration.

Source: [Supabase changelog](https://supabase.com/changelog)

## Deployment Paths

For the broader foundation gate, execution order, and deferred performance work,
see `docs/deployment/infrastructure-performance-foundation.md`.

### MVP Smoke Path

Use this only for temporary manual testing:

- Vercel Hobby for `apps/web`.
- Render Free for `apps/api`.
- Supabase Free if connection usage stays below limits.
- Upstash Free if Redis usage stays below limits.
- `LINE_WEBHOOK_QUEUE_MODE=inline` while using Upstash Free; enable `bullmq` only on paid or
  self-hosted Redis because idle workers consume monthly command quota.

Risk: Render Free cold starts can break LINE webhook reliability.

### Production-Safe Path

Use this before a real LINE OA production webhook is pointed at OmniChat:

- Render Starter or equivalent always-on API service.
- Supabase Pro when storage, connection, or advisor needs exceed Free.
- Upstash Pay-as-you-go before quota limits affect auth/session/queue behavior.
- Rotated Supabase credentials stored only in provider secret stores.
- `/api/v1/health` returns healthy DB + Redis status.

## Manual Smoke Test

After deployment:

1. Open `/api/v1/health` and confirm success envelope with DB and Redis healthy.
2. Log in as OWNER or ADMIN.
3. Open `/app/settings` and save LINE channel config.
4. Update LINE Developers webhook URL to `https://<api-host>/api/v1/line/webhook/<lineChannelId>`.
5. Click LINE webhook Verify.
6. Send a real inbound LINE message.
7. Confirm it appears in `/app/inbox`.
8. Send a reply from OmniChat and confirm LINE receives it.
