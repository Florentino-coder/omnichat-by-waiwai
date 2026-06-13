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

## Current Repo Checkpoint

- Render Blueprint: `render.yaml`
- Vercel project config: `vercel.json`
- Render service name: `omnichat-api`
- Render health check path: `/api/v1/health`
- Web API proxy env: `NEXT_PUBLIC_API_BASE_URL`
- Settings page can save LINE channel config through `POST /api/v1/line/channels`.

## Why Not Vercel Only

Vercel is good for the Next.js web app, but this project also has a NestJS API with Redis-backed auth/session behavior, LINE webhook routes, and long-running server needs. Keep the API as a separate service.

## Web Deploy - Vercel

- Framework preset: Next.js
- Root directory: repository root
- Build command: `npm run web:build`
- Install command: `npm ci`
- Output directory: `apps/web/.next`
- Git branch: `main`

These values are already stored in `vercel.json`, so importing the repository from Vercel should use the right defaults.

Required Vercel environment variables:

```bash
NEXT_PUBLIC_API_BASE_URL="https://<api-host>"
```

The web app proxies `/api/v1/*` to `NEXT_PUBLIC_API_BASE_URL` through `apps/web/next.config.ts`.

## API Deploy - Render Free

- Use Blueprint from `render.yaml`.
- Dashboard deeplink: `https://dashboard.render.com/blueprint/new?repo=https://github.com/Florentino-coder/omnichat-by-waiwai`
- Runtime: Node
- Region: Singapore
- Plan: Free
- Build command: `npm ci && npm run api:deploy:build`
- Start command: `npm run api:start`
- Health check path: `/api/v1/health`

Required API environment variables:

```bash
NODE_VERSION="20.14.0"
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

Generate `ENCRYPTION_KEY` locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Render generates `JWT_SECRET` and `JWT_REFRESH_SECRET` from the Blueprint. If you need stable secrets across service recreation, set them manually in Render instead.

## Migration Rule

Render Free does not include interactive Shell access. The API build command runs Prisma deploy tasks automatically:

```bash
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run api:build
```

Run Prisma migrations only against the intended database target. For Supabase, use:

- `DATABASE_URL` = transaction pooler
- `DIRECT_URL` = session pooler

Do not run destructive integration/e2e fixtures against the shared Supabase project unless the database is disposable.

## Production LINE Setup

1. Deploy API on Render.
2. Deploy web on Vercel.
3. Set Vercel `NEXT_PUBLIC_API_BASE_URL` to the Render API URL.
4. Set Render `APP_BASE_URL` to the Vercel web URL.
5. Login to web app as OWNER or ADMIN.
6. Open `/app/settings`.
7. Save LINE channel config:
   - Workspace ID
   - Channel name
   - LINE channel ID
   - Channel secret
   - Channel access token
8. In LINE Developers, set webhook URL:

```text
https://<render-api-host>/api/v1/line/webhook/<lineChannelId>
```

9. Click Verify in LINE Developers.
10. Send a real LINE message to the OA.
11. Confirm message appears in `/app/inbox`.
12. Send reply from inbox.

## Production Smoke Tests

```bash
curl https://<render-api-host>/api/v1/health
```

Expected: `success: true` envelope with DB and Redis status.

Manual browser checks:

- Vercel web opens.
- Login works.
- Settings saves LINE channel.
- LINE webhook verify succeeds.
- LINE inbound message appears in Inbox.
- Inbox reply sends back to LINE.

## Checkpoint

- [x] Stage 3 web build passed before deploy planning.
- [x] API health route exists at `/api/v1/health`.
- [x] Vercel API proxy support added.
- [x] Free deploy target chosen.
- [x] Render Blueprint added.
- [x] Settings page can save LINE channel config.
- [ ] Vercel project connected to GitHub `main`.
- [ ] Render API service connected to GitHub `main`.
- [ ] Supabase migrations verified on target database.
- [ ] Upstash Redis URL configured.
- [ ] LINE webhook URL updated to hosted API.
- [ ] Smoke test: login, inbox load, reply send, webhook receive.
