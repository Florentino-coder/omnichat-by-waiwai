# PRD - Stage 3: Unified Inbox

**Project:** OmniChat SaaS
**Stage:** 3 - Unified Inbox
**Status:** In progress

## Objective

Stage 3 makes stored LINE conversations usable by agents in a tenant-safe inbox. Agents can list conversations, open message threads, and reply from the inbox foundation built in Stage 2.

## Scope

- List tenant-scoped conversations ordered by most recent activity.
- Load tenant-scoped message threads for a selected conversation.
- Expose protected inbox API routes for agents.
- Open the web app Inbox navigation and add an inbox screen that uses the Stage 3 API shape.
- Keep all queries filtered by `tenantId`.
- Keep reply sending delegated to the Stage 2 LINE reply endpoint.

## Out Of Scope

- Customer CRM profile, notes, and timeline. These belong to Stage 4.
- New non-LINE channels.
- AI replies, search, reports, and QC workflows.
- BullMQ queue replacement. Stage 2 queue boundary remains in place until queue dependency approval.

## Checkpoints

- [x] Checkpoint A: Tenant-scoped inbox list and thread API pass tests.
- [x] Checkpoint B: Inbox web route renders conversation list, thread, and empty states.
- [x] Checkpoint C: Reply UI posts through the existing LINE reply route.
- [x] Checkpoint D: Docs, verification, and GitHub main checkpoint complete.
- [x] Checkpoint E: Web inbox and LINE settings use live authenticated API calls instead of mock data.
- [x] Checkpoint F: App rail opens live Settings route and LINE settings shows full webhook URL for production testing.
- [x] Checkpoint G: Inbox maps production LINE `externalThreadId` and refreshes conversations every 5 seconds.
- [x] Checkpoint H: Inbox shows LINE customer profile/channel detail, selected thread refreshes every 2 seconds, and Settings is ready for multiple LINE OA channels.

## Verification - 2026-06-13

- Passed: `npx jest --config apps/api/jest.config.cjs apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `npx jest --config apps/web/jest.config.cjs apps/web/__tests__/app-shell.test.tsx apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run api:build`
- Passed: `npm run web:typecheck`
- Passed: `npm run ui:typecheck`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npx jest --config apps/web/jest.config.cjs apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npx jest --config apps/web/jest.config.cjs apps/web/__tests__/app-shell.test.tsx apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npx jest --config apps/api/jest.config.cjs apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `npm run lint`
- Passed: `npm run web:build`
- Passed: secret scan for Supabase/Postgres credentials.
- Not run: API integration/e2e tests against Supabase.
- Safety note: Supabase pooler credentials were provided, but current API integration/e2e fixtures reset core tenant, user, workspace, LINE, conversation, message, and audit tables. Do not run those tests against a non-disposable Supabase database.

## Verification - 2026-06-14

- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx apps/web/__tests__/app-shell.test.tsx --runInBand`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run lint`
- Passed: `NEXT_PUBLIC_API_BASE_URL=https://omnichat-by-waiwai.onrender.com npm run web:build`
- Passed: `npm run web:test -- apps/web/__tests__/app-shell.test.tsx --runInBand`
- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run api:test -- apps/api/src/line/line-webhook.service.spec.ts --runInBand`
- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run web:test -- apps/web/__tests__/app-shell.test.tsx --runInBand`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run lint`
- Passed: `npm run api:build`
- Passed: `NEXT_PUBLIC_API_BASE_URL=https://omnichat-by-waiwai.onrender.com npm run web:build`
- Not run to completion: `npm run api:test -- --runInBand` because integration tests require `DATABASE_URL`; unit suites passed before the DB-backed RBAC integration suite failed at Prisma initialization.
