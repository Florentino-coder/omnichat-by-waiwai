# Stage 1 Remaining Superpowers Spec

Status: Approved for implementation planning
Date: 2026-06-12
Scope: Stage 1 only

This spec covers the approved Stage 1 remaining work split into three batches:

1. Backend security: email delivery, Redis refresh sessions, TOTP
2. RBAC and tenant isolation tests
3. Frontend foundation: Next.js app, design tokens, shared UI primitives

No Stage 2+ work is included. No dependencies may be added during implementation without founder approval.

---

## Batch 1: Backend Security

### Problem

Stage 1 backend auth is scaffolded, but outbound email delivery, Redis-backed refresh-token session cache, and real TOTP verification remain incomplete. Invitations cannot be delivered, refresh-token replay detection depends only on database state, and 2FA checks code presence without verifying the code value.

### In Scope

- Add an email delivery abstraction for Stage 1 auth/user emails:
  - invitation link
  - email verification
  - password reset
  - welcome email
- Wire invitation creation to send an invitation email after tenant-scoped invitation creation and audit logging.
- Add Redis-backed refresh-token session cache for login, refresh rotation, logout, expiry, and reuse detection.
- Keep the existing `RefreshToken` database table as durable session/audit record.
- Implement TOTP setup, verify, disable, and login validation.
- Add class-validator DTOs for new auth endpoints.
- Add audit logs for mutating auth/security events.

### Out of Scope

- Frontend auth screens.
- Stage 2 LINE OA or channel secrets.
- Full billing/payment behavior.
- Mandatory 2FA enforcement beyond optional Stage 1 support.
- New roles or permission model changes.
- Locked framework version changes.

### Tenant Isolation

- Protected endpoints must use `JwtAuthGuard`, `TenantGuard`, and `RolesGuard` where role-gated.
- Tenant-scoped queries must filter by `tenantId`.
- Public token endpoints may resolve invitation/reset/verification tokens without JWT, but mutations must write only in the token tenant context.
- Tenant A must not use Tenant B invitation, session, or audit data.

### RBAC

- Invitation email sending remains OWNER/ADMIN through the existing invitation create route.
- 2FA setup, verify, and disable are self-service for authenticated users.
- Refresh and logout are authenticated by refresh-token possession plus active session validation.

### Audit

Existing actions to use where possible:

- `LOGIN`
- `LOGOUT`
- `LOGIN_FAILED`
- `PASSWORD_CHANGED`
- `TWO_FA_ENABLED`
- `TWO_FA_DISABLED`
- `USER_INVITED`

Audit writes required:

- failed login
- logout
- refresh-token reuse detection
- 2FA enabled
- 2FA disabled
- password reset completed
- email verified

If implementation needs new audit enum values, update Prisma enum and migration in the same task.

### PlanLimit

- This batch creates no new counted tenant resource.
- Invitation acceptance must continue checking `PlanLimit.maxAgents` before creating workspace membership.
- Email sending does not require PlanLimit checks.

### Data and API Impact

- Prefer no Prisma schema change unless audit enum values are required.
- Keep `User.twoFaSecret` encrypted at rest with AES-256-GCM via `ENCRYPTION_KEY`.
- Keep refresh-token hashes in DB; never store raw refresh tokens.
- Store active refresh sessions in Redis by token hash with 7-day TTL.
- Redis metadata must include `userId`, `tenantId`, `workspaceId`, `role`, and expiry.
- On refresh rotation, create the new Redis entry before revoking the old one.
- On refresh-token reuse, revoke all active user sessions in DB and Redis.
- Add provider abstraction for email so provider choice stays isolated.
- Required env examples:
  - `EMAIL_FROM`
  - `APP_BASE_URL`
  - provider API key or SMTP credentials
- Email errors must not expose secrets or provider internals.
- Implement or complete:
  - `POST /api/v1/auth/2fa/setup`
  - `POST /api/v1/auth/2fa/verify`
  - `POST /api/v1/auth/2fa/disable`

### Tests

- Unit tests for email service template/link payloads.
- Unit tests for invitation create calling email after tenant-scoped invitation creation.
- Unit tests for deterministic email failure behavior without secret leakage.
- Unit tests for missing, invalid, and valid TOTP login paths.
- Unit tests for Redis session creation on login.
- Unit tests for refresh rotation in Redis and DB.
- Unit tests for logout revocation in Redis and DB.
- Unit tests for reused refresh token revoking all user sessions.
- Integration tests for invitation route RBAC and tenant scope.
- Integration tests for 2FA endpoint auth and tenant context.
- E2E/security tests for tenant session isolation, refresh replay detection, and audit tenant scope.

### Approved Defaults

- Email provider: Resend for MVP.
- Redis client: `ioredis`.
- TOTP library: `otplib`.
- TOTP setup response: return `otpauth://` URI first; QR image rendering can be handled later by frontend.
- Invitation email failure: fail the API request clearly instead of creating a sent-but-undelivered state.
- Refresh-token reuse detection: use existing audit action with metadata unless a clear enum gap appears during planning.

---

## Batch 2: RBAC Integration and Tenant Isolation E2E

### Problem

Stage 1 backend has guard and service unit coverage, but the release gate still needs API-level proof that protected routes enforce RBAC and tenant isolation through real controllers.

### In Scope

- Add integration tests for protected Stage 1 API routes:
  - authenticated vs unauthenticated access
  - OWNER/ADMIN/AGENT/QC/VIEWER allow and deny paths
  - `TenantGuard` plus `RolesGuard` through real controllers
- Add e2e tenant isolation tests using at least two tenants:
  - Tenant A cannot read, update, delete, or list Tenant B resources
  - cross-tenant IDs never return another tenant data
  - audit log, workspace, member, invitation, tenant settings, and plan endpoints remain tenant-scoped
- Use current repo tooling with npm and `package-lock.json`.
- Add or adjust npm scripts only if needed for e2e execution.

### Out of Scope

- Product behavior changes unless tests expose a real Stage 1 security defect.
- Frontend tests.
- Stage 2+ coverage.
- Schema/API changes unless required to fix a discovered Stage 1 security gap.

### Tenant Isolation

- Every tested business query must be scoped by `tenantId`.
- Cross-tenant resource access should return `404` when lookup is tenant-scoped and `403` only when guard/role failure occurs first.
- Test fixtures must isolate data per suite and clean up or reset deterministically.

### RBAC

- Role behavior must match `docs/security/permission-matrix.md`.
- No new roles.
- OWNER override behavior must be explicitly tested where supported.

### Audit

- Verify audit-log visibility is OWNER/ADMIN-only and tenant-scoped.
- Assert mutating endpoint audit writes where already implemented.
- Do not add audit enum values unless fixing a missing mutating-action audit gap.

### PlanLimit

- Workspace creation and member/agent creation tests must prove limits are enforced before creation.
- Plan endpoints must remain OWNER/ADMIN-scoped, with manual plan change OWNER-only.

### Data and API Impact

- No intended API contract changes.
- Test fixtures create deterministic tenants, users, roles, workspaces, invitations, plan limits, and audit logs.
- Response expectations must match the global success/error envelope.

### Tests

Required verification:

- `npm run lint`
- `npm run api:build`
- `npm run api:test`
- `npm run test:cov`
- `npm run api:test:e2e` if added

Coverage targets:

- RBAC matrix integration coverage for Stage 1 protected routes.
- Cross-tenant negative tests for list, read, update, delete, member, invitation, audit-log, plan, and settings paths.
- Unauthenticated requests return `401`.
- Authenticated but underprivileged requests return `403`.
- Authenticated cross-tenant resource access never returns another tenant data.

### Approved Defaults

- E2E tests run against local Docker PostgreSQL and Redis through test env variables.
- Add separate `api:test:e2e` script if the existing Jest `.spec.ts` pattern is not enough.
- Prefer `404` for cross-tenant resource IDs to avoid disclosure.
- Audit assertions focus on Stage 1 mutating endpoints already expected to log.

---

## Batch 3: Frontend Foundation

### Problem

Stage 1 needs a locked frontend foundation before auth and settings screens are built. The repo currently has backend foundation work, but no `apps/web` or `packages/ui`.

### In Scope

- Create `apps/web` as the Stage 1 frontend app using:
  - Next.js 15 App Router
  - React 19
  - strict TypeScript
  - TailwindCSS 3
- Configure shadcn/ui conventions:
  - component aliases
  - CSS variables
  - Tailwind color mappings
  - shared primitive styling
- Add Stage 1 design tokens from `omnichat-master-plan-addendum-v2.md` section 10:
  - white background
  - deep indigo primary
  - quiet borders
  - semantic success/warning/danger only for status
  - Plus Jakarta Sans headings
  - Inter UI/body
  - JetBrains Mono monospace
- Create `packages/ui` with shared primitives:
  - Button
  - Input
  - Label
  - Card
  - Badge
- Create minimal Stage 1 app shell foundation:
  - 56px icon rail
  - content area
  - disabled placeholders for future nav items
- Create auth page layout foundation:
  - centered 360px card
  - no decorative imagery
  - token-driven form styling
- Add frontend validation pattern using Zod.
- Wire root scripts for frontend typecheck, lint, test, and build.

### Out of Scope

- Stage 3 unified inbox implementation.
- Conversation list, chat thread, realtime messaging, customer panel, assignment, tags, or message bubbles.
- LINE OA UI.
- Dashboard/reporting UI.
- AI, search, automation, or billing checkout UI.
- New dependencies without founder approval.

### Tenant Isolation

- Tenant isolation remains backend-enforced.
- Frontend must never rely on client-side tenant filtering for security.
- App shell may assume authenticated tenant context but must not create tenant-scoped data in this foundation batch.

### RBAC

- RBAC relevance is limited to future settings navigation/rendering states.
- Backend remains source of truth for authorization.

### Audit

- No audit logging required for this foundation batch because no mutating frontend flows are implemented.

### PlanLimit

- No PlanLimit enforcement in frontend foundation.
- Future forms may display API limit errors, but backend enforcement remains mandatory.

### Data and API Impact

- No database schema changes.
- No backend endpoint changes.
- No API contract changes.
- Prepare typed API client shape compatible with existing response envelope:
  - `success: true, data, meta?`
  - `success: false, error`
- Form schemas use Zod.

### Tests

- Typecheck `apps/web` with strict TypeScript.
- Validate Tailwind/shadcn token mappings compile.
- Unit tests for `packages/ui` primitives where behavior exists.
- Smoke/render tests for:
  - root layout
  - auth layout shell
  - app shell layout
  - primitive components
- CI scripts include frontend checks once frontend package exists.

### Approved Defaults

- Package manager remains npm for this repo because `package-lock.json` is present.
- Add required frontend dependencies for the locked stack.
- Scaffold empty routes for the Stage 1 sitemap when useful for layout verification.
- Icon library: `lucide-react`, matching common shadcn usage.

---

## Global Verification

Before any batch is marked complete, run the strongest available verification:

```bash
npm run lint
npm run api:build
npm run api:test
npm run test:cov
```

When frontend scripts exist, also run their typecheck, lint, test, and build scripts.

If a required script is unavailable, the implementation report must name the missing script and the closest verification command run instead.

---

## Checkpoints

- Checkpoint C: founder approves implementation plan before any code changes.
- Checkpoint D: each batch section reports tests run, docs updated, tenant/RBAC/audit/PlanLimit checks, and residual risk.
- Checkpoint E: final verification reports all test results, changed files, migration status, and readiness.
- Checkpoint F: founder chooses merge, PR, keep branch, or discard.
