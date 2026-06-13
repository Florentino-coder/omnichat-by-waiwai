# Stage 3 Unified Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Unified Inbox slice: tenant-scoped conversation list, message thread API, and web inbox shell.

**Architecture:** Reuse Stage 2 `Conversation` and `Message` tables. Add a focused NestJS `inbox` module for read APIs, then connect the existing Next.js app shell to a compact 3-pane inbox route. Keep replies in the existing Stage 2 LINE reply endpoint to avoid duplicate send logic.

**Tech Stack:** NestJS 10, Prisma 5, Next.js 15 App Router, React 19, TailwindCSS, Jest.

---

### Task 1: Inbox Read API

**Files:**
- Create: `apps/api/src/inbox/inbox.service.spec.ts`
- Create: `apps/api/src/inbox/inbox.service.ts`
- Create: `apps/api/src/inbox/inbox.controller.ts`
- Create: `apps/api/src/inbox/inbox.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] Write failing service tests for tenant-scoped conversation list and message thread lookup.
- [x] Run focused Jest and confirm failure because `InboxService` does not exist.
- [x] Add `InboxService` with `listConversations(tenantId)` and `getConversationMessages(tenantId, conversationId)`.
- [x] Add protected `InboxController` routes: `GET /api/v1/inbox/conversations` and `GET /api/v1/inbox/conversations/:id/messages`.
- [x] Register `InboxModule` in `AppModule`.
- [x] Run focused Jest and confirm pass.

### Task 2: Inbox Web Shell

**Files:**
- Create: `apps/web/app/app/inbox/page.tsx`
- Modify: `apps/web/app/app/layout.tsx`
- Test: `apps/web/__tests__/inbox-page.test.tsx`
- Test: `apps/web/__tests__/app-shell.test.tsx`

- [x] Write failing web tests for enabled Inbox nav and inbox empty/thread layout.
- [x] Add inbox page with dense conversation list, message thread, and customer-side placeholder panel.
- [x] Enable Inbox nav in the app shell while keeping later-stage routes disabled.
- [x] Run web tests and confirm pass.

### Task 3: Checkpoint Verification

**Files:**
- Modify: `docs/prd/stage-3-unified-inbox.md`

- [x] Run `npm run api:build`.
- [x] Run focused API and web tests.
- [x] Run `npm run lint`.
- [x] Run secret scan.
- [x] Mark completed checkpoint boxes in the Stage 3 PRD only after verification evidence exists.

**Local caveat:** API integration/e2e execution is blocked until `DATABASE_URL` is available in the shell. Test cases are added for inbox tenant isolation and RBAC.
