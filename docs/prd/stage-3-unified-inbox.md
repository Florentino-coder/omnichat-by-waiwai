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
- [x] Checkpoint I: Inbox supports per-channel conversation identity, customer nicknames, LINE OA badge colors, and sticker message display.
- [x] Checkpoint J: Inbox viewport fits desktop/tablet/mobile better, same LINE customer can appear separately per OA, and old cross-OA message rows are repaired during migration.
- [x] Checkpoint K: Inbox supports LINE-like in-progress status, live status timer, configurable alert threshold, paged conversation loading, Enter-to-send replies, and HTTPS image URL replies.
- [x] Checkpoint L: Inbox assignment, priority, tags, and internal notes API with tenant-scoped audit logs.
- [x] Checkpoint M: Inbox UI operations for assignment, priority, tags, internal notes, and quick saved reply insertion.
- [x] Checkpoint N: Saved reply lite API for tenant-scoped quick replies.
- [x] Checkpoint O: Thai UI foundation and Noto Sans Thai font.
- [x] Checkpoint P: LINE OA-scoped Quick Reply in inbox with Auto Enter.
- [x] Checkpoint Q: Settings Quick Reply CRUD per LINE OA.
- [x] Checkpoint R: Tenant switch UI, team invitation UI, invite acceptance flow, and inbox component/RSC shell split.

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

## Verification - 2026-06-14 Checkpoint I

- Passed: `npm run api:test -- apps/api/src/line/line-webhook.service.spec.ts apps/api/src/inbox/inbox.service.spec.ts apps/api/src/line/line-channels.service.spec.ts --runInBand`
- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx apps/web/__tests__/app-shell.test.tsx --runInBand`
- Passed: `npm run lint`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run api:build`
- Passed: `NEXT_PUBLIC_API_BASE_URL=https://omnichat-by-waiwai.onrender.com npm run web:build`

## Verification - 2026-06-14 Checkpoint J

- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run api:test -- apps/api/src/line/line-webhook.service.spec.ts --runInBand`
- Passed: `npm run lint`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run api:test -- apps/api/src/line/line-webhook.service.spec.ts apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `DATABASE_URL=postgresql://user:pass@localhost:5432/omnichat DIRECT_URL=postgresql://user:pass@localhost:5432/omnichat npx prisma validate`
- Passed: `npm run api:build`
- Passed: `NEXT_PUBLIC_API_BASE_URL=https://omnichat-by-waiwai.onrender.com npm run web:build`
- Passed with CRLF-only warnings: `git diff --check`
- Note: LINE Messaging API profile/webhook data does not include the LINE OA Manager customer note field. OmniChat-local notes remain Stage 4 CRM scope.

## Verification - 2026-06-14 Checkpoint K

- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `npm run api:test -- apps/api/src/line/line-reply.service.spec.ts --runInBand`
- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts apps/api/src/line/line-reply.service.spec.ts --runInBand`
- Passed: `npm run lint`
- Passed: `npm run web:test -- --runInBand`
- Passed: `DATABASE_URL=postgresql://user:pass@localhost:5432/omnichat DIRECT_URL=postgresql://user:pass@localhost:5432/omnichat npx prisma validate`
- Passed: `npm run api:build`
- Passed: `NEXT_PUBLIC_API_BASE_URL=https://omnichat-by-waiwai.onrender.com npm run web:build`
- Passed with CRLF-only warnings: `git diff --check`
- Note: copied binary images need an upload/storage layer before LINE can receive them as image messages. Stage 3 now supports HTTPS image URL replies and shows pasted-image previews instead of pretending local clipboard blobs are sendable.

## Verification - 2026-06-14 Checkpoint L-O

- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `npm run api:build`
- Passed: `npm run api:typecheck`
- Passed: `npm run lint`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts apps/api/src/line/line-reply.service.spec.ts --runInBand`
- Passed: `DATABASE_URL=postgresql://user:pass@localhost:5432/omnichat DIRECT_URL=postgresql://user:pass@localhost:5432/omnichat npx prisma validate`
- Passed: `npm run web:build`
- Passed with CRLF-only warnings: `git diff --check`
- Not run: `npx prisma migrate dev --name stage_3b_inbox_operations` because Docker/local PostgreSQL was not running in this environment. Migration SQL was created and Prisma schema validation/generation passed; apply against a disposable/local DB before deploying.

## Verification - 2026-06-14 Checkpoint L-O API Wiring

- Added: inbox conversation list now returns active tag links with tag metadata so the UI can render real tag state.
- Added: inbox UI loads tenant tags, saved replies, and selected conversation internal notes from Stage 3B APIs.
- Added: saved reply buttons insert API-backed reply bodies into the composer; tag chips attach/remove tags through inbox APIs.
- Hardened: internal note delete now rejects AGENT deletion of another member note; ADMIN/OWNER can delete tenant notes.
- Applied: `20260614110000_stage_3b_inbox_operations` with `npx prisma migrate deploy`; `npx prisma migrate status` reports database schema is up to date.
- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `npx prisma validate`

## Verification - 2026-06-15 Checkpoint P Quick Reply

- Added: saved replies can be scoped to one LINE OA through `lineChannelId`, with tenant validation before create/update.
- Added: inbox saved-reply API supports `?lineChannelId=` so each conversation loads Quick Reply data for its own LINE OA only.
- Added: inbox UI labels entries as `{LINE OA name} : Quick Reply {title}` and uses a `+` button to insert the body into the reply composer.
- Added: Quick Reply Auto Enter switch. OFF inserts into composer; ON sends through the existing LINE reply endpoint immediately.
- Added migration: `20260615090000_scope_saved_replies_to_line_channel`.
- Applied: `20260615090000_scope_saved_replies_to_line_channel` with `npx prisma migrate deploy`; `npx prisma migrate status` returned success.
- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npx prisma validate`
- Passed: `npm run lint`
- Passed: `npm run api:typecheck`
- Passed: `npm run api:build`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts apps/api/src/line/line-reply.service.spec.ts --runInBand`
- Passed: `npm run web:build`

## Verification - 2026-06-15 Checkpoint Q Quick Reply Management

- Added: Settings page Quick Reply manager for creating, editing, and deleting replies per LINE OA.
- Added: manager reloads replies through `?lineChannelId=` and writes through existing audited saved-reply APIs.
- Added: Settings test coverage for per-OA reply list, create, and delete flows.
- Passed: `npm run web:test -- apps/web/__tests__/app-shell.test.tsx --runInBand`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run lint`
- Passed: `npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts apps/api/src/line/line-reply.service.spec.ts --runInBand`
- Passed: `npm run api:build`
- Passed: `npm run web:build`
- Passed with CRLF-only warnings: `git diff --check`

## Verification - 2026-06-16 Checkpoint R Tenant UI + Inbox Split

- Added: `GET /api/v1/auth/memberships` returns active tenant/workspace memberships for the signed-in user.
- Added: `POST /api/v1/auth/switch-tenant` issues new tokens scoped to the selected workspace and writes `TENANT_SWITCHED` audit logs.
- Added migration: `20260616090000_add_tenant_switched_audit_action`.
- Added: tenant select page, team settings page, completed invite accept flow, and cookie-backed app route middleware.
- Added: inbox route server wrapper with Suspense skeleton and focused component structure for conversation list, chat window, customer panel, mobile bottom nav, and status config.
- Finished: Phase 2 inbox render layer now wires the component structure to live conversations, messages, reply send, notes, assignment, tags, quick replies, status, and priority operations.
- Added: RSC initial conversation load for sessions with an access-token cookie; client polling remains the refresh fallback.
- Passed: `npm run prisma:validate`
- Passed: `npm run lint`
- Passed: `npm run api:build`
- Passed: `npm run web:test -- --runInBand`
- Passed: `npm run web:build`
- Passed: `npm run api:test -- --runInBand`
- Passed: `npm run api:test -- apps/api/src/auth/auth.service.spec.ts apps/api/src/invitations/invitations.service.spec.ts apps/api/src/workspaces/workspaces.service.spec.ts apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed with CRLF-only warnings: `git diff --check`
