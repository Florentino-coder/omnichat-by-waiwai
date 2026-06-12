# OmniChat SaaS Codex-First Master Plan

Version: 2026
Owner: Solo Founder + Codex

## Goal

Build OmniChat as a multi-tenant customer service SaaS platform for LINE OA, KPI, QC, AI assistance, SaaS billing, and later omnichannel operations.

## Operating Rule

Never build the whole system at once. Every stage must be designed, reviewed, implemented, tested, and documented before moving to the next stage.

Every database task must declare its target database first: local Docker, Supabase, Coolify, staging, or production. Never run migrations without explicit database connection sources. For Supabase + Prisma, use `DATABASE_URL` for the transaction pooler and `DIRECT_URL` for migrations/session pooler.

## Roles

Founder owns product vision, business logic, priorities, and final decisions.

Codex owns architecture, backend, frontend, database, testing, documentation, and refactoring within the assigned stage scope.

## Stages

Active scope is MVP Track only until founder explicitly opens a Post-MVP stage.

| Stage | Name | Track | Goal |
|---|---|---|---|
| 0 | Architecture | MVP | Document PRD, ERD, database design, permissions, API, tenant model, security, UI sitemap, roadmap. |
| 0.5 | Repo Bootstrap | MVP | Prepare git, ignore rules, canonical docs layout, Prisma artifact readiness, and DB target decision. |
| 1 | Foundation + Billing Lite | MVP | Tenant, authentication, RBAC, users, workspace, invitation, manual plan limits, usage-meter hook. |
| 2 | LINE OA Integration | MVP | LINE settings, webhook, message sync, reply service, LINE security checklist. |
| 3 | Unified Inbox | MVP | Inbox, realtime, assignment, tags, priority, status. |
| 4 | Customer CRM | MVP | Customer profile, timeline, notes, tags. |
| 5 | Knowledge System Lite | MVP | Saved replies first; full knowledge base later. |
| 6 | Reporting Lite | MVP | Basic dashboard only. |
| 7 | KPI Engine Lite | MVP | Response time and resolution time only. |
| 8 | QC Center | Post-MVP | Conversation review, scoring, feedback, compliance. |
| 9 | Audit Log | MVP | Immutable trace for auth, replies, deletes, assignments, exports, settings. |
| 10 | Automation | Post-MVP | Auto assign, auto tag, auto close, reminders, SLA. |
| 11 | Search | Post-MVP | Global and full-text search via OpenSearch. |
| 12 | AI Copilot | Post-MVP | Reply suggestions, grammar, tone, summaries. |
| 13 | RAG System | Post-MVP | Document upload, embeddings, semantic retrieval. |
| 14 | AI QA | Post-MVP | Automated scoring and policy detection. |
| 15 | Hybrid AI Agent | Post-MVP | AI drafts replies, human approves. |
| 16 | Full AI Agent | Post-MVP | AI replies automatically with escalation and confidence thresholds. |
| 17 | Billing Full | MVP after Billing Lite | Stripe/Omise/2C2P integration, invoices, self-serve billing. |
| 18 | Multi-Channel | Post-MVP | Facebook, Messenger, Telegram, Instagram, WhatsApp, email, web chat. |

## Internal Dogfooding Gate

Before Stage 5 starts, founder's own company must use OmniChat as a real tenant for 2-4 weeks after Stages 3-4 are usable. Exit criteria: no open P0/P1 dogfood bugs, tenant isolation tests pass with seed and internal tenants active, one week with zero missed/lost LINE messages, team prefers OmniChat for daily replies, and audit logs show real login/message/assignment/status events.

## Stage 2 Entry Gate

Stage 2 design must cover LINE webhook signature verification, encrypted LINE secrets/tokens, LINE rate limit and retry handling via queue, fast webhook `200` response, and channel token refresh strategy.

## Stage 1-A Split

Stage 1-A1 is Prisma artifact readiness: schema, migration SQL, seed script, package setup, validate, and generate.

Stage 1-A2 is database apply: set `DATABASE_URL`, run migration, seed data, verify tables, verify indexes, verify seed records.

Stage 1-A status: complete for Supabase PostgreSQL. The initial schema, seed flow, RLS hardening, migration ordering fix, and invitation foreign key indexes have been applied and verified. Remaining Stage 1 work starts with backend auth and tenant-scoped API implementation.

## Stage 1 Billing Lite

Stage 1 adds manual Billing Lite before full billing:

- `Tenant.planId` defaults to `free`; add `trialEndsAt`.
- Add `PlanLimit` for `planId`, `maxWorkspaces`, `maxAgents`, and `maxAiCreditsPerMonth`.
- Add `UsageCounter` as future AI usage hook, unused until AI stages.
- Add `GET /api/v1/tenants/me/plan` and `PATCH /api/v1/tenants/me/plan`; plan change is OWNER-only and manual in MVP.
- Add audit actions `PLAN_CHANGED`, `PLAN_LIMIT_EXCEEDED`, and `USAGE_THRESHOLD_REACHED`.
- Enforce plan limits before creating workspaces, agents, and future counted resources.

## Success Target

Year 1: 10 companies.

Year 2: 100 companies.

Year 3: 1000 companies.

Final goal: AI customer operations platform, enterprise SaaS, multi-tenant, omnichannel, AI-driven, commercially viable.
