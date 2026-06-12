# OmniChat SaaS — Master Plan Addendum v2 (Scope & Sequencing Revision)

Version: 2026-v2
Status: Merged into canonical docs; retained for reference until founder approves archive/delete
Applies on top of: `codex-first-master-plan.md`, `stage-0.md`, `permission-matrix.md`, `AGENTS.md`, `er-diagram-stage1.mermaid`

> This file does NOT replace the existing docs. It is a delta to be reviewed by the founder, then merged into the relevant files (master plan, AGENTS.md, stage-0.md, permission matrix) before Codex starts the next task. Once approved, paste the relevant section into the target doc and delete this addendum.

---

## 0. Why This Addendum Exists

The original 18-stage plan is architecturally sound but sequences "business-critical" capabilities (billing, audit, usage limits, monitoring) too late relative to the Year-1 goal (10 paying companies). This addendum:

1. Defines an **MVP Track** — the minimum subset of stages needed to onboard and bill real customers.
2. Pulls forward a **Billing Lite** layer into Stage 1, instead of waiting for Stage 17.
3. Extends the already-generic `AUDIT_LOGS` schema with new action types instead of creating a new stage.
4. Adds an **AI usage metering hook** now so Stage 12+ doesn't require a retroactive schema migration.
5. Adds a **LINE OA security checklist** as a Stage 2 entry gate.
6. Adds a **Testing / CI / Monitoring baseline** that applies starting Stage 1, not as a separate stage.

No existing Stage 1 schema needs to be torn down — the changes below are additive (new columns/enums, new optional tables) and compatible with the current Prisma schema and RLS setup.

---

## 1. MVP Track vs Post-MVP

Reclassify the 18 stages into two tracks. Codex should treat MVP Track stages as the only ones in scope until the founder explicitly opens a Post-MVP stage.

| Stage | Name | Track | Note |
|---|---|---|---|
| 0 | Architecture | MVP | done |
| 0.5 | Repo Bootstrap | MVP | done |
| 1 | Foundation (+ Billing Lite, see §2) | MVP | in progress |
| 2 | LINE OA Integration | MVP | add security checklist, §5 |
| 3 | Unified Inbox | MVP | |
| 4 | Customer CRM | MVP | |
| 5 | Knowledge System | MVP (lite) | saved replies only; full KB can wait |
| 6 | Reporting | MVP (lite) | basic dashboard only |
| 7 | KPI Engine | MVP (lite) | response/resolution time only |
| 9 | Audit Log | MVP | already underway, extend per §3 |
| 17 | Billing (full) | MVP (lite in Stage 1, full version here) | Stripe/Omise integration, invoices |
| 8 | QC Center | Post-MVP | |
| 10 | Automation | Post-MVP | |
| 11 | Search | Post-MVP | |
| 12 | AI Copilot | Post-MVP | metering hook added now, §4 |
| 13 | RAG System | Post-MVP | |
| 14 | AI QA | Post-MVP | |
| 15 | Hybrid AI Agent | Post-MVP | |
| 16 | Full AI Agent | Post-MVP | |
| 18 | Multi-Channel | Post-MVP | |

Rationale: a company can be sold and onboarded with Stages 0–7 + 9 + Billing Lite. QC, automation, search, and the AI stages are differentiators for renewal/expansion, not for the first sale.

---

## 1A. Internal Dogfooding Milestone (Checkpoint after Stage 3–4)

Before starting Stage 5, the founder's own company is onboarded as the **first real tenant** and the team uses OmniChat for actual day-to-day LINE OA customer service for a defined trial period. This is a hard gate, not optional polish — it is the cheapest way to surface bugs and missing functions before any external customer sees them.

### 1A.1 Setup

- [ ] Create a real (non-seed) tenant for the founder's own company via the normal onboarding flow (not a script-inserted row) — this exercises Stage 1 registration/invitation end-to-end.
- [ ] Set this tenant's `planId` to `enterprise` (or a dedicated `internal` plan with effectively unlimited `PlanLimit` values) so Billing Lite limits never block real usage.
- [ ] Connect the company's actual LINE OA channel (Stage 2) — not a sandbox/mock channel, so webhook reliability and token handling get tested against real LINE traffic.
- [ ] Invite the actual team members (whoever currently handles LINE OA chats) with their real roles (OWNER/ADMIN/AGENT) so RBAC is tested with real usage patterns, not just unit tests.

### 1A.2 Trial Period

- Duration: **2–4 weeks** of using OmniChat as the *only* tool for handling this LINE OA account (no falling back to the official LINE app, or only as emergency backup).
- During the trial, keep the seed/demo tenant from Stage 1-A intact and periodically re-run the tenant-isolation test suite — having two real-ish tenants active simultaneously is the best way to catch cross-tenant leakage early.

### 1A.3 Feedback & Bug Capture (lightweight — no new feature)

- Do **not** build a new "feedback module" — that's scope creep. Use GitHub Issues (or whatever issue tracker the repo already uses) with a label `dogfood`.
- Every issue found during the trial gets one of: `bug`, `missing-function`, `ux-friction`.
- Weekly during the trial, founder + Codex review the `dogfood` label together: bugs get fixed immediately (within current stage scope — auth/inbox/CRM bugs are Stage 1-4 bugs, not new stages); `missing-function` items get triaged into either "small enough to add now" or "defer to a later stage" — defer by default unless it blocks daily usage.

### 1A.4 Exit Criteria (must pass before Stage 5 starts)

- [ ] Zero open `bug` issues labeled `dogfood` with severity P0/P1.
- [ ] Tenant isolation test suite passes with both the internal tenant and the seed tenant active.
- [ ] At least one full week of the trial period had zero missed/lost LINE messages (verified via audit logs / webhook logs).
- [ ] The team actually prefers OmniChat over the previous tool for day-to-day replies (qualitative — ask them).
- [ ] Audit log review shows login, message, assignment, and status-change events are all being recorded correctly for real usage (not just test data).

### 1A.5 AGENTS.md Gate Rule

Add to the "Quality & Compliance Rules" section (§7 below):

```markdown
- Stage 5 (and any later stage) MUST NOT begin until the Internal Dogfooding
  Milestone (master-plan-addendum-v2.md §1A) exit criteria are checked off
  in stage-0.md. If new bugs are found during dogfooding, they are fixed
  as Stage 1-4 work, not deferred into the next stage's scope.
```

---

## 2. Stage 1 Addition — "Billing Lite" (Plan & Usage Gate)

Goal: every tenant has a plan, a seat limit, and a usage record from day one, even before the full Stripe/Omise integration in Stage 17.

### 2.1 Schema additions (additive, no breaking changes)

```prisma
// Extend existing Tenant model — planId already exists, just give it a default
model Tenant {
  // ...existing fields...
  planId        String   @default("free") // "free" | "starter" | "pro" | "enterprise"
  trialEndsAt   DateTime?
  // ...
}

// New table — tenant-level plan limits, seeded per planId
model PlanLimit {
  id              String @id @default(uuid())
  planId          String @unique
  maxWorkspaces   Int
  maxAgents       Int
  maxAiCreditsPerMonth Int @default(0) // used later by AI metering, §4
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 2.2 New endpoints (Stage 1 scope)

```
GET    /api/v1/tenants/me/plan        Get current plan + limits + usage snapshot
PATCH  /api/v1/tenants/me/plan        Change plan (OWNER only, manual/admin-set in MVP)
```

In MVP, plan changes are set manually by the founder (no payment processor yet). Stage 17 later swaps this for self-serve checkout without changing the schema.

### 2.3 Enforcement

`TenantGuard` checks `WorkspaceMember` count against `PlanLimit.maxAgents` and `Workspace` count against `maxWorkspaces` on create operations. Return `403 PLAN_LIMIT_EXCEEDED` with the response envelope already defined in `AGENTS.md`.

### 2.4 Permission matrix addition

Add to `permission-matrix.md` under a new "Billing Lite (Stage 1)" section:

| Action | OWNER | ADMIN | AGENT | QC | VIEWER |
|---|---|---|---|---|---|
| View Plan & Usage | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change Plan (manual, MVP) | ✅ | ❌ | ❌ | ❌ | ❌ |

This section should later be merged with the existing "Billing (Stage 17)" table when full billing lands — same rows, just remove "(MVP)" qualifiers.

---

## 3. Audit Log Extension (No New Stage Needed)

`AUDIT_LOGS` already has a generic `action` enum + `targetType`/`targetId`/`metadata` JSON — this is good. No schema change required, only enum additions as new features ship.

Add these `AuditAction` enum values now, to be used starting Stage 1:

```
PLAN_CHANGED
PLAN_LIMIT_EXCEEDED
USAGE_THRESHOLD_REACHED   // reserved for §4
```

Rule for Codex going forward: **any new mutating endpoint in any future stage must add a corresponding `AuditAction` value and write a log entry**, rather than waiting for a dedicated "audit stage." This should be added as a rule in `AGENTS.md` (see §7).

---

## 4. AI Usage Metering Hook (Prep for Stage 12+)

No AI code is built now. Only reserve the schema shape so Stage 12 doesn't require a migration that touches historical data.

```prisma
model UsageCounter {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  metric      String   // e.g. "ai_tokens", "ai_requests"
  periodStart DateTime
  periodEnd   DateTime
  value       BigInt   @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, metric, periodStart])
  @@index([tenantId])
}
```

This table is created in Stage 1 migration but unused until Stage 12. `PlanLimit.maxAiCreditsPerMonth` (added in §2.1) is the cap this table will be checked against later.

---

## 5. Stage 2 Entry Checklist — LINE OA Security

Before Stage 2 implementation begins, the design doc for Stage 2 must explicitly cover:

- Webhook signature verification (`x-line-signature` HMAC-SHA256 against channel secret) — reject unsigned/invalid requests with `401` before any processing.
- LINE channel secrets and access tokens stored via the existing AES-256-GCM encryption pattern (already specified in `stage-0.md` Security Design) — never logged.
- Rate limit / retry handling for LINE Messaging API (LINE enforces per-channel rate limits; outbound replies should queue via BullMQ rather than call LINE API synchronously from the webhook handler).
- Webhook handler must return `200` quickly (LINE retries on timeout) — processing happens async via queue.
- Token refresh strategy for channel access tokens (long-lived vs short-lived tokens depending on LINE API version used).

This checklist becomes a gate item in the Stage 2 PRD's "Deliverables Checklist," mirroring the Stage 0 format.

---

## 6. Testing / CI / Monitoring Baseline (effective immediately, all stages)

Add to `AGENTS.md` under a new "Quality Baseline" section (applies retroactively to Stage 1 work in progress):

- **CI pipeline**: every PR/commit runs `pnpm test`, `pnpm test:cov` (>80% threshold already defined), and `pnpm lint` before merge. If no CI is set up yet, this is a Stage 1 task, not deferred.
- **Error tracking**: integrate a basic error reporting hook (e.g. Sentry or self-hosted alternative compatible with Coolify) in `apps/api` — even a minimal config is acceptable for MVP, but the hook must exist so later stages don't bolt it on under time pressure.
- **Structured logging**: NestJS Logger output must be JSON-structured (not just `console.log` replacement) so Grafana/Prometheus (already in the locked stack per `AGENTS.md`) can ingest it later without rework.
- **Health check endpoint**: `GET /api/v1/health` returning DB + Redis connectivity status — required before any deployment to Coolify staging/production.

---

## 7. AGENTS.md — New Rules to Append

Add a new section "## Quality & Compliance Rules" to `AGENTS.md`:

```markdown
## Quality & Compliance Rules

- Any new mutating endpoint MUST add a corresponding AuditAction enum value
  and write an audit log entry as part of the same task — not a follow-up.
- Any new tenant-scoped resource that has a count limit (workspaces, agents,
  AI credits, etc.) MUST be checked against PlanLimit before creation.
- CI must pass (test, test:cov >80%, lint) before a task is marked complete.
- New stages start from the "MVP Track" list in
  docs/architecture/master-plan-addendum-v2.md unless the founder explicitly
  opens a Post-MVP stage.
- Stage 5 (and any later stage) MUST NOT begin until the Internal Dogfooding
  Milestone (master-plan-addendum-v2.md §1A) exit criteria are checked off
  in stage-0.md. Bugs found during dogfooding are fixed as Stage 1-4 work,
  not deferred into the next stage's scope.
```

---

## 8. Open Decisions — Additions to Stage 0 List

Append to the "Open Decisions" section of `stage-0.md`:

5. **Plan tiers for MVP** — confirm the initial `planId` values and their limits (suggested starting point: `free` = 1 workspace / 2 agents / 0 AI credits, `starter` = 1 workspace / 5 agents, `pro` = 3 workspaces / 20 agents). Founder to finalize before Stage 1 migration adds `PlanLimit` seed data.
6. **Payment processor for Stage 17** — Stripe vs Omise vs 2C2P (Omise/2C2P have stronger Thai PromptPay support, relevant for SME customers).
7. **Error tracking provider** — Sentry (hosted) vs self-hosted alternative (GlitchTip) given Coolify deployment.

---

## 9. Suggested Codex Session Prompt (after founder approval)

```
Read AGENTS.md first (including the new Quality & Compliance Rules section).
Current stage: 1
Task: Add Billing Lite (PlanLimit, UsageCounter, Tenant.planId default,
  plan endpoints, AuditAction enum additions) per
  docs/architecture/master-plan-addendum-v2.md sections 2-4.
Reference files: prisma/schema.prisma, er-diagram-stage1.mermaid,
  permission-matrix.md, stage-0.md
Do not touch anything outside this task scope.
```

---

## 10. Frontend Design System — Stage 1 UI Foundation

Stage 0's "Frontend Sitemap" lists the pages but never defined a visual identity. This section fixes that with a concrete, lockable token set: white background, deep indigo ("krahm") accent, minimal/premium feel — close to the Linear/Vercel school of SaaS design. Two reference mockups (login screen, inbox 3-pane layout) were produced alongside this addendum; this section is the written spec Codex should implement from.

This is a **Stage 1 task**, scoped to the auth pages already in the Stage 1 sitemap (`/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/invite/accept`, `/app/settings/*`). The inbox-specific layout (3-pane: conversation list / thread / customer panel) is documented here now so Stage 3 doesn't have to invent it later, but is **not** built until Stage 3.

### 10.1 Color tokens

Define as CSS variables in `apps/web/app/globals.css` per shadcn/ui convention. Light mode only for MVP — dark mode is a Post-MVP nice-to-have, but variable names should be dark-mode-ready.

| Token (shadcn name) | Hex | Usage |
|---|---|---|
| `--background` | `#FFFFFF` | page background |
| `--foreground` | `#16182B` | primary text |
| `--card` | `#FFFFFF` | card surfaces |
| `--card-border` | `#E8E9F0` | 1px borders on cards, inputs, dividers |
| `--secondary` | `#F7F7FB` | sidebar / nav-rail background, hover rows |
| `--muted-foreground` | `#767A8C` | secondary text, labels, placeholders |
| `--muted-foreground-light` | `#9A9DB0` | timestamps, hints, disabled icons |
| `--primary` | `#4338CA` | brand indigo — buttons, active nav, links, focus ring |
| `--primary-hover` | `#372FA3` | button hover/active |
| `--primary-soft` | `#EEF0FF` | active-row highlight, badges, avatar backgrounds |
| `--success` | `#1F9D72` | open/active status badges |
| `--success-soft` | `#E8F6EF` | success badge background |
| `--warning` | `#D97706` | SLA/at-risk indicators (Stage 7+) |
| `--danger` | `#DC4444` | destructive actions, error states |

Rule: **one accent color only** (`--primary` indigo). Success/warning/danger are reserved for status semantics (conversation status, KPI thresholds), never used decoratively. This is what keeps the "เนียบๆ เรียบๆ ดูแพง" feel — avoid adding a second "fun" accent color later without founder sign-off.

### 10.2 Typography

```
Display / headings (h1-h3):  "Plus Jakarta Sans", weight 500
Body / UI / forms:            "Inter", weights 400 and 500
Monospace (IDs, tokens, logs): "JetBrains Mono"
```

Load via `next/font` (Google Fonts) — do not use `<link>` tags in production (that's a chat-mockup-only shortcut). Type scale:

| Role | Size | Weight |
|---|---|---|
| Page title (h1) | 22px | 500 |
| Section header (h2) | 16px | 500 |
| Body | 14px | 400 |
| Label / caption | 12px | 400 |
| Micro (timestamps, badges) | 11px | 400 |

Two weights only across the whole app: 400 and 500. No bold (700) anywhere — bold reads as "templated SaaS," and the brief explicitly wants understated/premium.

### 10.3 Layout & spacing

- Border radius: `8px` for inputs/buttons/badges, `12px` for cards and the app frame, `16px` for modals.
- Borders: `1px solid var(--card-border)` everywhere — no drop shadows for hierarchy. Use `--secondary` background fills to separate regions instead of shadows (matches the reference mockups).
- Spacing scale: Tailwind defaults (4/8/12/16/24/32px). Page padding 24px on desktop, 16px on mobile.
- Icons: outline-style icon set (Tabler icons, already MIT-licensed and easy to self-host) at 18-20px, `--muted-foreground-light` when inactive, `--primary` when active.

### 10.4 Reference layouts

**Auth pages (Stage 1, build now):** centered 360px card on white background, per the login mockup — logo mark (28-32px rounded-square, `--primary` background, white "O" or wordmark monogram), form fields with 12px labels, full-width primary button, secondary links in `--primary` color, no decorative imagery.

**App shell (Stage 1, build now — used by `/app/settings/*`):** left icon-rail (56px, `--secondary` background) + content area. Icon rail items: Inbox, Customers, Reports, Knowledge, Settings (some routes are placeholders until their stage ships — render as disabled/greyed icons rather than hiding them, so the IA is visible early).

**Inbox 3-pane (Stage 3, spec only for now):** icon-rail (56px) + conversation list (200px) + thread (flex-1) + customer panel (160px), per the inbox mockup. Active conversation row uses `--secondary` background + 2px `--primary` left border. Customer (incoming) bubbles use `--secondary` background; agent (outgoing) bubbles use `--primary` background with white text.

### 10.5 Implementation notes for Codex

- Add `apps/web/app/globals.css` CSS variables and `tailwind.config` color mappings as a discrete Stage 1 task before building individual auth pages — every page consumes these tokens, so getting them right first avoids rework.
- Build the shared primitives in `packages/ui` (Button, Input, Label, Card, Badge) styled per §10.1-10.3 using shadcn/ui as the base, then compose auth pages from those primitives.
- The two reference mockups (login, inbox) generated alongside this addendum are visual references only — re-derive exact markup from shadcn components + these tokens rather than copying raw HTML/CSS.

---

_End of Addendum v2 — merge relevant sections into master plan, AGENTS.md, stage-0.md, and permission-matrix.md, then archive this file._
