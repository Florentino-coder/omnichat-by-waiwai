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
- [ ] Checkpoint C: Reply UI posts through the existing LINE reply route.
- [ ] Checkpoint D: Docs, verification, and GitHub main checkpoint complete.

## Verification - 2026-06-13

- Passed: `npx jest --config apps/api/jest.config.cjs apps/api/src/inbox/inbox.service.spec.ts --runInBand`
- Passed: `npx jest --config apps/web/jest.config.cjs apps/web/__tests__/app-shell.test.tsx apps/web/__tests__/inbox-page.test.tsx --runInBand`
- Passed: `npm run api:build`
- Passed: `npm run web:typecheck`
- Passed: `npm run ui:typecheck`
- Passed: `npm run web:test -- --runInBand`
- Passed: secret scan for Supabase/Postgres credentials.
- Blocked locally: API integration/e2e tests require `DATABASE_URL` in the shell. The new inbox tenant-isolation and RBAC cases are written but need a test database URL to execute.
