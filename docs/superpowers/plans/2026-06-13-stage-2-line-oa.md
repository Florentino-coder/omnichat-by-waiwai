# Stage 2 LINE OA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tenant-scoped LINE OA connection, webhook sync, and reply backend for MVP use.

**Architecture:** Add Prisma models for LINE channel, conversation, and message. Add a NestJS `line` module with settings, webhook, queue boundary, and reply services. Keep frontend unchanged until Stage 3.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 16, Node 20 `fetch`, Redis/ioredis already present.

---

### Task 1: LINE Schema And DTOs

**Files:**
- Modify: `prisma/schema.prisma`
- Add: `apps/api/src/line/dto/connect-line-channel.dto.ts`
- Add: `apps/api/src/line/dto/reply-line-message.dto.ts`

- [ ] Add `LineChannel`, `Conversation`, `Message`, and message enums with `tenantId`.
- [ ] Add audit actions for connect/update/inbound/reply.
- [ ] Validate inputs with class-validator.

### Task 2: LINE Services

**Files:**
- Add: `apps/api/src/line/line-signature.service.ts`
- Add: `apps/api/src/line/line-channels.service.ts`
- Add: `apps/api/src/line/line-webhook.service.ts`
- Add: `apps/api/src/line/line-reply.service.ts`
- Add: `apps/api/src/line/line-webhook-queue.service.ts`

- [ ] Verify LINE signatures using encrypted channel secret.
- [ ] Encrypt token and secret before persistence.
- [ ] Process inbound message events into tenant-scoped conversation/message rows.
- [ ] Send replies via LINE Messaging API and persist outbound messages.

### Task 3: LINE Controllers And Module

**Files:**
- Add: `apps/api/src/line/line-channels.controller.ts`
- Add: `apps/api/src/line/line-webhook.controller.ts`
- Add: `apps/api/src/line/line.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/test/helpers/api-test-app.ts`

- [ ] Add protected channel settings endpoints.
- [ ] Add public webhook endpoint with raw body support.
- [ ] Register module and raw body capture.

### Task 4: Tests And Checkpoint

**Files:**
- Add: `apps/api/src/line/*.spec.ts`
- Modify: `docs/prd/stage-2-line-oa.md`

- [ ] Watch unit tests fail before implementation.
- [ ] Implement minimum code.
- [ ] Run focused tests, build, lint, and full API tests.
- [ ] Update checkpoint boxes.

