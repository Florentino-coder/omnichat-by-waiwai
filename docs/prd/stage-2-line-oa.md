# PRD - Stage 2: LINE OA Integration

**Project:** OmniChat SaaS
**Stage:** 2 - LINE OA Integration
**Status:** In progress

## Objective

Stage 2 connects one or more LINE OA channels to a tenant workspace, accepts verified LINE webhooks, stores inbound messages, and sends replies through the LINE Messaging API.

## Scope

- Store LINE channel settings per tenant and workspace.
- Encrypt LINE channel secret and access token with the Stage 1 AES-256-GCM secret service.
- Verify `x-line-signature` with HMAC-SHA256 before accepting webhook payloads.
- Return webhook `200` quickly, then process events through a queue boundary.
- Store LINE inbound messages as tenant-scoped conversations and messages.
- Send text replies and persist outbound reply messages.
- Audit channel settings, inbound messages, and replies.

## Out Of Scope

- Stage 3 inbox UI, realtime assignment, tags, priority, and status workflows.
- Stage 4 customer CRM profile and notes.
- Additional channels beyond LINE.

## Checkpoints

- [x] Checkpoint A: Stage 2 schema, API shape, and tests added.
- [x] Checkpoint B: LINE webhook signature verification and async processing pass tests.
- [x] Checkpoint C: LINE reply service pass tests.
- [x] Checkpoint D: Docs, migration, and verification complete.

## Verification Checkpoint - 2026-06-13

- Prisma migration `20260613090000_add_stage2_line_oa` applied to Supabase PostgreSQL.
- `prisma migrate status` reports database schema is up to date.
- LINE focused API tests pass: 4 suites, 5 tests.
- Full API test pass: 20 suites, 65 tests.
- API e2e pass: 1 suite, 8 tests.
- Coverage pass: statements 88.96%, functions 81.81%, lines 87.78%; branch coverage remains 64.33%.
- Lint/typecheck pass for API, UI package, and web app.
- Secret scan found no committed Supabase URL/password.
