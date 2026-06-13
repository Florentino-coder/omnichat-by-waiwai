# Free MVP Deploy Checkpoint

**Date:** 2026-06-13
**Target:** Stage 3 deploy-ready slice
**Decision:** Use split free hosting for the first live MVP check.

## Recommended Free Stack

| Part | Platform | Reason |
|---|---|---|
| Web | Vercel Hobby | Best fit for Next.js App Router and GitHub auto deploy. |
| API | Render Free Web Service | Runs NestJS as a long-running Node service. |
| Database | Supabase Free Postgres | Current project database target already uses Supabase pooler URLs. |
| Redis | Upstash Redis Free | Better fit than local Redis for free hosted MVP. |

## Why Not Vercel Only

Vercel is good for the Next.js web app, but this project also has a NestJS API with Redis-backed auth/session behavior, LINE webhook routes, and long-running server needs. Keep the API as a separate service.

## Web Deploy - Vercel

- Framework preset: Next.js
- Root directory: repository root
- Build command: `npm run web:build`
- Install command: `npm ci`
- Output: Next.js default

Required Vercel environment variables:

```bash
NEXT_PUBLIC_API_BASE_URL="https://<api-host>"
```

The web app proxies `/api/v1/*` to `NEXT_PUBLIC_API_BASE_URL` through `apps/web/next.config.ts`.

## API Deploy - Render Free

- Runtime: Node 20
- Build command: `npm ci && npx prisma generate && npm run api:build`
- Start command: `npm run api:start`
- Health check path: `/api/v1/health`

Required API environment variables:

```bash
DATABASE_URL="<supabase-transaction-pooler-url>"
DIRECT_URL="<supabase-session-pooler-url>"
REDIS_URL="<upstash-redis-url>"
JWT_SECRET="<strong-random-secret>"
JWT_REFRESH_SECRET="<strong-random-secret>"
ENCRYPTION_KEY="<32-byte-base64-key>"
EMAIL_FROM="OmniChat <no-reply@your-domain>"
APP_BASE_URL="https://<web-host>"
RESEND_API_KEY="<resend-api-key>"
MINIO_ENDPOINT="<future-storage-endpoint>"
MINIO_ACCESS_KEY="<future-storage-access-key>"
MINIO_SECRET_KEY="<future-storage-secret-key>"
```

## Migration Rule

Run Prisma migrations only against the intended database target. For Supabase, use:

- `DATABASE_URL` = transaction pooler
- `DIRECT_URL` = session pooler

Do not run destructive integration/e2e fixtures against the shared Supabase project unless the database is disposable.

## Checkpoint

- [x] Stage 3 web build passed before deploy planning.
- [x] API health route exists at `/api/v1/health`.
- [x] Vercel API proxy support added.
- [x] Free deploy target chosen.
- [ ] Vercel project connected to GitHub `main`.
- [ ] Render API service connected to GitHub `main`.
- [ ] Supabase migrations verified on target database.
- [ ] Upstash Redis URL configured.
- [ ] LINE webhook URL updated to hosted API.
- [ ] Smoke test: login, inbox load, reply send, webhook receive.
