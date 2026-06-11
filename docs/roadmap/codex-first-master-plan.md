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

| Stage | Name | Goal |
|---|---|---|
| 0 | Architecture | Document PRD, ERD, database design, permissions, API, tenant model, security, UI sitemap, roadmap. |
| 0.5 | Repo Bootstrap | Prepare git, ignore rules, canonical docs layout, Prisma artifact readiness, and DB target decision. |
| 1 | Foundation | Tenant, authentication, RBAC, users, workspace, invitation. |
| 2 | LINE OA Integration | LINE settings, webhook, message sync, reply service. |
| 3 | Unified Inbox | Inbox, realtime, assignment, tags, priority, status. |
| 4 | Customer CRM | Customer profile, timeline, notes, tags. |
| 5 | Knowledge System | Knowledge base, saved replies, FAQ, internal docs. |
| 6 | Reporting | Dashboards, reports, charts, exports. |
| 7 | KPI Engine | Response time, resolution time, message count, closed tickets, workload. |
| 8 | QC Center | Conversation review, scoring, feedback, compliance. |
| 9 | Audit Log | Immutable trace for auth, replies, deletes, assignments, exports, settings. |
| 10 | Automation | Auto assign, auto tag, auto close, reminders, SLA. |
| 11 | Search | Global and full-text search via OpenSearch. |
| 12 | AI Copilot | Reply suggestions, grammar, tone, summaries. |
| 13 | RAG System | Document upload, embeddings, semantic retrieval. |
| 14 | AI QA | Automated scoring and policy detection. |
| 15 | Hybrid AI Agent | AI drafts replies, human approves. |
| 16 | Full AI Agent | AI replies automatically with escalation and confidence thresholds. |
| 17 | Billing | Plans, subscriptions, invoices, usage limits. |
| 18 | Multi-Channel | Facebook, Messenger, Telegram, Instagram, WhatsApp, email, web chat. |

## Stage 1-A Split

Stage 1-A1 is Prisma artifact readiness: schema, migration SQL, seed script, package setup, validate, and generate.

Stage 1-A2 is database apply: set `DATABASE_URL`, run migration, seed data, verify tables, verify indexes, verify seed records.

Stage 1-A status: complete for Supabase PostgreSQL. The initial schema, seed flow, RLS hardening, migration ordering fix, and invitation foreign key indexes have been applied and verified. Remaining Stage 1 work starts with backend auth and tenant-scoped API implementation.

## Success Target

Year 1: 10 companies.

Year 2: 100 companies.

Year 3: 1000 companies.

Final goal: AI customer operations platform, enterprise SaaS, multi-tenant, omnichannel, AI-driven, commercially viable.
