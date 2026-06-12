# Stage 1 Remaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each batch must complete Checkpoint D before the next batch starts.

**Goal:** Complete the approved Stage 1 remaining foundation work: backend security, RBAC/tenant isolation verification, and frontend design foundation.

**Architecture:** Work is split into three independent batches with disjoint write areas where possible. Backend security adds mail, Redis refresh sessions, and TOTP behind isolated services. Test hardening adds real-controller RBAC and tenant isolation e2e coverage. Frontend foundation creates `apps/web` and `packages/ui` without implementing Stage 2+ product features.

**Tech Stack:** NestJS 10, TypeScript strict, Prisma 5, PostgreSQL 16, Redis 7, Jest/Supertest, Next.js 15, React 19, TailwindCSS 3, shadcn-style UI primitives.

---

## Checkpoint Rules

- Checkpoint C: founder approves this plan before code changes.
- Checkpoint D: after each batch, report tests run, docs updated, tenant/RBAC/audit/PlanLimit checks, changed files, and residual risk.
- Checkpoint E: after all batches, run final verification and report readiness.
- Checkpoint F: founder chooses merge, PR, keep branch, or discard.

Use npm because this repo has `package-lock.json`.

## Implementation Checkpoint Log

- 2026-06-13 Checkpoint C: founder approved implementation by requesting code work.
- 2026-06-13 Batch 1 local fix checkpoint: fixed 2FA refresh, failed-login audit, and Redis session index cleanup after subagent quota was exhausted. Targeted auth/refresh-session tests passed 14/14.
- 2026-06-13 Batch 2 scaffold checkpoint: added API test helper, deterministic Stage 1 fixtures, RBAC integration spec, tenant-isolation e2e spec, and `api:test:e2e` script. RBAC/e2e tests now compile far enough to require local PostgreSQL; local run blocked because `localhost:5432` is not running.
- 2026-06-13 Batch 3 implementation checkpoint: added Next.js 15 web foundation, Tailwind/shadcn-style tokens, auth route shells, app settings shell, API envelope types, Zod auth schemas, shared `@omnichat/ui` primitives, and frontend/UI tests. Verification passed: `npm run web:typecheck`, `npm run web:test` (7 suites, 9 tests), `npm run web:build`, `npm run ui:typecheck`, `npm run ui:test` (3 suites, 3 tests), `npm run lint`, `npm run api:build`, and targeted backend security tests (7 suites, 29 tests). Full DB-backed RBAC/e2e remains blocked because Docker is not installed on this machine.
- 2026-06-13 Batch 2 DB checkpoint: connected to the Supabase project through IPv4 Supavisor pooler because direct database host is IPv6-only on this machine. `npx prisma migrate status` reports the database schema is up to date. Fixed DB-backed test isolation defects without changing production code: extended timeout for remote DB specs, used fresh workspaces for delete-RBAC checks, and used fresh invitations for revoke-RBAC checks. Added PlanLimit/audit e2e assertions. Verification passed: `npm run api:test -- rbac-integration.spec.ts --runInBand` (5 tests), `npm run api:test:e2e -- tenant-isolation.e2e-spec.ts` (8 tests), `npm run lint`, and `npm run api:build`.
- 2026-06-13 Checkpoint E: complete verification passed using the Supabase IPv4 Supavisor pooler for DB-backed tests. Commands passed: `npm run prisma:validate`, `npm run lint`, `npm run api:build`, `npm run api:test -- --runInBand` (16 suites, 60 tests), `npm run test:cov -- --runInBand` (statements 90.25%, branches 70.00%, functions 84.71%, lines 89.23%), `npm run api:test:e2e` (1 suite, 8 tests), `npm run web:typecheck`, `npm run web:test` (7 suites, 9 tests), `npm run web:build`, `npm run ui:typecheck`, and `npm run ui:test` (3 suites, 3 tests). Sidecar subagent audit found no Stage 2+ product implementation and no unapproved direct dependencies. Added `*.tsbuildinfo` to `.gitignore` after verification generated a local TypeScript build artifact.
- 2026-06-13 Checkpoint F: founder requested GitHub upload. Fresh verification for publish passed after one transient Supabase pooler retry: `npm run prisma:validate`, `npm run lint`, `npm run api:build`, `npm run api:test -- --runInBand` (16 suites, 60 tests), `npm run test:cov -- --runInBand` (statements 90.25%, branches 70.00%, functions 84.71%, lines 89.23%), `npm run api:test:e2e` (1 suite, 8 tests), `npm run web:typecheck`, `npm run web:test`, `npm run web:build`, `npm run ui:typecheck`, and `npm run ui:test`. Preparing Stage 1 branch for commit, push, and draft PR.

---

## Batch 1: Backend Security

**Purpose:** Add Resend-backed email delivery abstraction, Redis-backed refresh-token sessions, and real encrypted TOTP support.

**Dependencies Approved For This Batch:**

```bash
npm install ioredis otplib resend
```

Expected: `package.json` and `package-lock.json` update. No pnpm/yarn lockfile is created.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/dto/login.dto.ts`
- Modify: `apps/api/src/invitations/invitations.module.ts`
- Modify: `apps/api/src/invitations/invitations.service.ts`
- Modify: `apps/api/src/invitations/invitations.service.spec.ts`
- Create: `apps/api/src/mail/mail.module.ts`
- Create: `apps/api/src/mail/mail.service.ts`
- Create: `apps/api/src/mail/mail.service.spec.ts`
- Create: `apps/api/src/mail/types/mail.types.ts`
- Create: `apps/api/src/redis/redis.module.ts`
- Create: `apps/api/src/redis/redis.service.ts`
- Create: `apps/api/src/redis/redis.service.spec.ts`
- Create: `apps/api/src/auth/refresh-session.service.ts`
- Create: `apps/api/src/auth/refresh-session.service.spec.ts`
- Create: `apps/api/src/auth/types/refresh-session.types.ts`
- Create: `apps/api/src/auth/crypto-secret.service.ts`
- Create: `apps/api/src/auth/crypto-secret.service.spec.ts`
- Create: `apps/api/src/auth/totp.service.ts`
- Create: `apps/api/src/auth/totp.service.spec.ts`
- Create: `apps/api/src/auth/dto/two-fa-code.dto.ts`
- Modify only if a new audit enum is truly needed: `prisma/schema.prisma`

### Task 1.1: Install Approved Backend Dependencies

- [ ] **Step 1: Install dependencies**

```bash
npm install ioredis otplib resend
```

Expected: npm updates `package.json` and `package-lock.json`; no other dependency family is added intentionally.

- [ ] **Step 2: Verify dependency tree**

```bash
npm run api:typecheck
```

Expected: existing typecheck result remains valid before imports are used.

### Task 1.2: Mail Abstraction

- [ ] **Step 1: Write failing mail tests**

Add `apps/api/src/mail/mail.service.spec.ts` covering:

- invitation link equals `${APP_BASE_URL}/invite/accept?token=<token>`
- verification link equals `${APP_BASE_URL}/verify-email?token=<token>`
- reset link equals `${APP_BASE_URL}/reset-password?token=<token>`
- welcome email includes display name and no token
- provider failure throws `ServiceUnavailableException` with message `Email delivery failed`

Run:

```bash
npm run api:test -- apps/api/src/mail/mail.service.spec.ts
```

Expected: FAIL because `MailService` does not exist.

- [ ] **Step 2: Implement mail module/service**

Create:

- `MailModule`
- `MailService`
- typed payloads in `mail.types.ts`

Methods:

- `sendInvitationEmail({ to, inviteToken, tenantName, workspaceName, expiresAt })`
- `sendEmailVerification({ to, token })`
- `sendPasswordReset({ to, token, expiresAt })`
- `sendWelcomeEmail({ to, displayName })`

Use env vars:

- `EMAIL_FROM`
- `APP_BASE_URL`
- `RESEND_API_KEY`

Provider errors must not expose secrets or provider internals.

- [ ] **Step 3: Verify mail tests pass**

```bash
npm run api:test -- apps/api/src/mail/mail.service.spec.ts
```

Expected: PASS.

### Task 1.3: Send Invitation Email

- [ ] **Step 1: Write failing invitation service tests**

Extend `apps/api/src/invitations/invitations.service.spec.ts`:

- `create()` verifies workspace by `id`, `tenantId`, and `deletedAt: null`
- creates invitation
- writes `AuditAction.USER_INVITED`
- calls `mailService.sendInvitationEmail()` after audit log
- mail failure rejects with `Email delivery failed`
- return shape remains `{ invitation, inviteToken }`

Run:

```bash
npm run api:test -- apps/api/src/invitations/invitations.service.spec.ts
```

Expected: FAIL because `InvitationsService` does not inject `MailService`.

- [ ] **Step 2: Implement invitation mail wiring**

Modify `InvitationsModule` and `InvitationsService` to inject `MailService`. Fetch tenant/workspace context needed for email. Keep tenant-scoped workspace lookup.

- [ ] **Step 3: Verify invitation tests pass**

```bash
npm run api:test -- apps/api/src/invitations/invitations.service.spec.ts
```

Expected: PASS.

### Task 1.4: Redis Refresh Session Service

- [ ] **Step 1: Write failing Redis and refresh-session tests**

Create tests for:

- `RedisService` wraps `ioredis` and uses `REDIS_URL`
- `RefreshSessionService.store()` writes `refresh:<tokenHash>` with TTL `604800`
- metadata includes `userId`, `tenantId`, `workspaceId`, `role`, `expiresAt`
- `get()` returns parsed metadata
- `delete()` removes one token hash
- `deleteAllForUser()` deletes all indexed user session keys

Run:

```bash
npm run api:test -- apps/api/src/redis/redis.service.spec.ts apps/api/src/auth/refresh-session.service.spec.ts
```

Expected: FAIL because services do not exist.

- [ ] **Step 2: Implement Redis and refresh-session services**

Store only token hashes and metadata. Never store raw refresh tokens.

- [ ] **Step 3: Verify tests pass**

```bash
npm run api:test -- apps/api/src/redis/redis.service.spec.ts apps/api/src/auth/refresh-session.service.spec.ts
```

Expected: PASS with mocked Redis client.

### Task 1.5: Login Stores DB And Redis Session

- [ ] **Step 1: Write failing auth login test**

Extend `apps/api/src/auth/auth.service.spec.ts`:

- successful login creates DB refresh token hash
- successful login calls `refreshSessionService.store()` with `userId`, `tenantId`, `workspaceId`, `role`, and expiry
- access token payload still includes `tenantId`, `workspaceId`, and `role`

Run:

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: FAIL because `AuthService` does not use `RefreshSessionService`.

- [ ] **Step 2: Implement login session storage**

Modify `AuthModule` and `AuthService.issueTokens()` to create DB record and Redis session.

- [ ] **Step 3: Verify auth tests pass**

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: PASS.

### Task 1.6: Refresh Rotation And Reuse Detection

- [ ] **Step 1: Write failing refresh tests**

Add tests:

- refresh requires DB token active and Redis session present
- rotation creates new DB+Redis session before revoking old DB token and deleting old Redis key
- missing Redis session for otherwise active DB token rejects
- revoked DB token triggers reuse detection
- reuse detection revokes all DB sessions, deletes Redis sessions for user, and writes `AuditAction.LOGIN_FAILED` with metadata `{ reason: "REFRESH_REUSE_DETECTED" }`

Run:

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: FAIL until refresh flow uses Redis.

- [ ] **Step 2: Implement rotation and reuse handling**

Modify `AuthService.refresh()` narrowly. Keep error message `Refresh token reuse detected` for replay.

- [ ] **Step 3: Verify refresh tests pass**

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: PASS.

### Task 1.7: Logout Revokes DB And Redis

- [ ] **Step 1: Write failing logout test**

Add test:

- `logout(refreshToken)` hashes token
- finds token context when available
- revokes DB token
- deletes Redis key
- writes `AuditAction.LOGOUT` when user/tenant context is resolvable

Run:

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: FAIL until logout uses Redis and audit.

- [ ] **Step 2: Implement logout revocation**

Keep `POST /api/v1/auth/logout` returning 204.

- [ ] **Step 3: Verify logout tests pass**

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: PASS.

### Task 1.8: Encrypted TOTP Services

- [ ] **Step 1: Write failing crypto/TOTP tests**

Create tests:

- encrypted secret output does not include plaintext
- decrypt roundtrip works with valid `ENCRYPTION_KEY`
- invalid or missing `ENCRYPTION_KEY` throws configuration error
- `TotpService.verify()` accepts valid `otplib` code
- `TotpService.verify()` rejects invalid or missing code
- generated setup response includes `otpauth://` URI with issuer `OmniChat`

Run:

```bash
npm run api:test -- apps/api/src/auth/crypto-secret.service.spec.ts apps/api/src/auth/totp.service.spec.ts
```

Expected: FAIL because services do not exist.

- [ ] **Step 2: Implement AES-256-GCM crypto and TOTP service**

Use Node `crypto`. Store encrypted secret string only. Do not log secrets.

- [ ] **Step 3: Verify crypto/TOTP tests pass**

```bash
npm run api:test -- apps/api/src/auth/crypto-secret.service.spec.ts apps/api/src/auth/totp.service.spec.ts
```

Expected: PASS.

### Task 1.9: 2FA Endpoints

- [ ] **Step 1: Write failing 2FA service/controller tests**

Add tests:

- `POST /api/v1/auth/2fa/setup` requires JWT + tenant context
- setup stores encrypted pending/current secret and returns `{ otpauthUri }`
- `POST /api/v1/auth/2fa/verify` validates code, enables `twoFaEnabled`, writes `AuditAction.TWO_FA_ENABLED`
- `POST /api/v1/auth/2fa/disable` validates code, clears secret, disables flag, writes `AuditAction.TWO_FA_DISABLED`
- invalid code rejects with `UnauthorizedException`

Run:

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: FAIL until endpoints/services exist.

- [ ] **Step 2: Implement DTO and endpoints**

Create `TwoFaCodeDto` using class-validator. Add guarded endpoints with `JwtAuthGuard` and `TenantGuard`.

- [ ] **Step 3: Verify 2FA tests pass**

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: PASS.

### Task 1.10: TOTP Login Validation

- [ ] **Step 1: Write failing login validation tests**

Add tests:

- user with `twoFaEnabled: true` and missing code rejects
- invalid code rejects and writes `LOGIN_FAILED`
- valid code logs in

Run:

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: FAIL because current implementation only checks presence.

- [ ] **Step 2: Implement real TOTP login verification**

Include `twoFaSecret` in login user selection. Decrypt and verify via `TotpService`.

- [ ] **Step 3: Verify login tests pass**

```bash
npm run api:test -- apps/api/src/auth/auth.service.spec.ts
```

Expected: PASS.

### Task 1.11: Batch 1 Verification

- [ ] **Step 1: Run backend verification**

```bash
npm run prisma:validate
npm run lint
npm run api:build
npm run api:test
npm run test:cov
```

Expected: all pass. If coverage remains below 80%, report exact coverage result and keep Stage 1 release gate open.

- [ ] **Step 2: Checkpoint D report**

Report:

- changed files
- tests run
- tenant isolation impact
- RBAC impact
- audit actions written
- PlanLimit unchanged/preserved
- residual risks

---

## Batch 2: RBAC Integration And Tenant Isolation E2E

**Purpose:** Add API-level proof that Stage 1 protected routes enforce auth, tenant isolation, RBAC, PlanLimit, and audit visibility.

**Files:**

- Create: `apps/api/test/helpers/api-test-app.ts`
- Create: `apps/api/test/helpers/stage-1-fixtures.ts`
- Create: `apps/api/test/rbac-integration.spec.ts`
- Create: `apps/api/test/tenant-isolation.e2e-spec.ts`
- Create: `apps/api/jest-e2e.config.cjs`
- Modify: `package.json`
- Modify: `package-lock.json` only if npm updates scripts metadata
- Modify production files only if tests expose real security defects:
  - `apps/api/src/tenants/tenants.controller.ts`
  - `apps/api/src/tenants/tenants.service.ts`
  - `apps/api/src/workspaces/workspaces.controller.ts`
  - `apps/api/src/workspaces/workspaces.service.ts`
  - `apps/api/src/invitations/invitations.controller.ts`
  - `apps/api/src/invitations/invitations.service.ts`
  - `apps/api/src/audit-logs/audit-logs.controller.ts`
  - `apps/api/src/audit-logs/audit-logs.service.ts`

### Task 2.1: Test Harness And Fixtures

- [ ] **Step 1: Write test app helper**

Create `api-test-app.ts` to build `AppModule` and apply:

- `/api/v1` global prefix
- `HttpExceptionFilter`
- `ResponseEnvelopeInterceptor`
- `ValidationPipe`
- `JWT_SECRET=test-jwt-secret`

- [ ] **Step 2: Write deterministic fixtures**

Create `stage-1-fixtures.ts`:

- resets rows in dependency order:
  - audit logs
  - invitations
  - refresh tokens
  - workspace members
  - workspaces
  - tenant settings
  - tenants
  - users
  - plan limits
- creates plan limits `free`, `starter`, `pro`
- creates Tenant A and Tenant B
- creates settings, workspaces, users, memberships for OWNER, ADMIN, AGENT, QC, VIEWER
- creates invitations and audit logs per tenant
- provides `signAccessToken({ userId, email, tenantId, workspaceId, role })`

- [ ] **Step 3: Typecheck helpers**

```bash
npm run api:typecheck
```

Expected: PASS or only fixture typing failures that are fixed before continuing.

### Task 2.2: RBAC Integration Tests

- [ ] **Step 1: Add failing RBAC integration tests**

Create `rbac-integration.spec.ts` covering:

- `GET /api/v1/tenants/me`: no token `401`; all roles `200`
- `PATCH /api/v1/tenants/me`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `GET /api/v1/tenants/me/settings`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `PATCH /api/v1/tenants/me/settings`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `GET /api/v1/tenants/me/plan`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `PATCH /api/v1/tenants/me/plan`: OWNER `200`; ADMIN/AGENT/QC/VIEWER `403`
- `GET /api/v1/workspaces`: all roles `200`
- `POST /api/v1/workspaces`: OWNER/ADMIN `201`; AGENT/QC/VIEWER `403`
- `PATCH /api/v1/workspaces/:id`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `DELETE /api/v1/workspaces/:id`: OWNER `200`; ADMIN/AGENT/QC/VIEWER `403`
- `GET /api/v1/workspaces/:id/members`: all roles `200`
- `PATCH /api/v1/workspaces/:id/members/:userId`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `DELETE /api/v1/workspaces/:id/members/:userId`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `POST /api/v1/invitations`: OWNER/ADMIN `201`; AGENT/QC/VIEWER `403`
- `GET /api/v1/invitations`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `DELETE /api/v1/invitations/:id`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`
- `GET /api/v1/audit-logs`: OWNER/ADMIN `200`; AGENT/QC/VIEWER `403`

Run:

```bash
npm run api:test -- rbac-integration.spec.ts --runInBand
```

Expected: FAIL for any real RBAC/controller gaps or missing test config.

- [ ] **Step 2: Fix only real RBAC defects**

Allowed fixes:

- missing guard
- missing `@Roles`
- wrong role list
- missing tenant context propagation

Run targeted test after each fix.

- [ ] **Step 3: Verify RBAC integration tests pass**

```bash
npm run api:test -- rbac-integration.spec.ts --runInBand
```

Expected: PASS.

### Task 2.3: Tenant Isolation E2E Tests

- [ ] **Step 1: Add e2e config and script**

Create `apps/api/jest-e2e.config.cjs` with `testRegex: ".*\\.e2e-spec\\.ts$"`.

Modify `package.json`:

```json
"api:test:e2e": "jest --config apps/api/jest-e2e.config.cjs --runInBand"
```

- [ ] **Step 2: Add failing tenant isolation e2e tests**

Create `tenant-isolation.e2e-spec.ts`:

- Tenant A `GET /api/v1/workspaces` returns only Tenant A workspaces
- Tenant A `GET /api/v1/workspaces/:tenantBWorkspaceId` returns `404`
- Tenant A `PATCH /api/v1/workspaces/:tenantBWorkspaceId` returns `404`
- Tenant A `DELETE /api/v1/workspaces/:tenantBWorkspaceId` returns `404`
- Tenant A `GET /api/v1/workspaces/:tenantBWorkspaceId/members` returns `404`
- Tenant A `PATCH /api/v1/workspaces/:tenantBWorkspaceId/members/:tenantBUserId` returns `404`
- Tenant A `DELETE /api/v1/workspaces/:tenantBWorkspaceId/members/:tenantBUserId` returns `404`
- Tenant A `GET /api/v1/invitations` returns only Tenant A invitations
- Tenant A `DELETE /api/v1/invitations/:tenantBInvitationId` returns `404`
- Tenant A `GET /api/v1/audit-logs` returns only Tenant A audit logs
- Tenant A `GET /api/v1/tenants/me/settings` returns Tenant A settings
- Tenant A `PATCH /api/v1/tenants/me/settings` changes only Tenant A settings
- Tenant A `GET /api/v1/tenants/me/plan` reports only Tenant A usage
- Tenant A `PATCH /api/v1/tenants/me/plan` changes only Tenant A plan
- cross-tenant resource IDs never appear in `success: true` responses

Run:

```bash
npm run api:test:e2e -- tenant-isolation.e2e-spec.ts
```

Expected: FAIL for any missing e2e setup or real tenant-scope gaps.

- [ ] **Step 3: Fix only real tenant isolation defects**

Allowed fixes:

- add `tenantId` to Prisma `where`
- replace unscoped `findUnique` resource lookup with tenant-scoped `findFirst`
- return `NotFoundException` for cross-tenant resource IDs
- add missing audit tenant filter

- [ ] **Step 4: Verify tenant e2e tests pass**

```bash
npm run api:test:e2e -- tenant-isolation.e2e-spec.ts
```

Expected: PASS.

### Task 2.4: PlanLimit And Audit Assertions

- [ ] **Step 1: Extend e2e tests**

Add cases:

- workspace limit reached returns plan-limit error and creates no workspace
- workspace limit failure writes Tenant A `PLAN_LIMIT_EXCEEDED`
- invitation accept at max agent limit creates no user/member
- agent limit failure does not change Tenant B data
- plan change as Tenant A OWNER writes Tenant A `PLAN_CHANGED`
- Tenant B audit logs do not include Tenant A plan change

Run:

```bash
npm run api:test:e2e -- tenant-isolation.e2e-spec.ts
```

Expected: FAIL only where current implementation misses required Stage 1 behavior.

- [ ] **Step 2: Fix only real PlanLimit/audit defects**

Allowed fixes:

- check PlanLimit before create
- write missing audit log for already-required Stage 1 mutation
- add tenant filter to audit lookup

- [ ] **Step 3: Verify PlanLimit/audit tests pass**

```bash
npm run api:test:e2e -- tenant-isolation.e2e-spec.ts
```

Expected: PASS.

### Task 2.5: Batch 2 Verification

- [ ] **Step 1: Run verification**

```bash
npm run lint
npm run api:build
npm run api:test
npm run test:cov
npm run api:test:e2e
```

Expected: all pass. If coverage is below 80%, report exact result and keep release gate open.

- [ ] **Step 2: Checkpoint D report**

Report:

- changed files
- tests run
- RBAC matrix coverage
- tenant isolation coverage
- audit assertions
- PlanLimit assertions
- residual risks

---

## Batch 3: Frontend Foundation

**Purpose:** Create Stage 1 frontend foundation without implementing product flows outside Stage 1.

**Dependencies Approved For This Batch:**

```bash
npm install next@15 react@19 react-dom@19 zod lucide-react class-variance-authority clsx tailwind-merge
npm install -D @types/react @types/react-dom tailwindcss@3 postcss autoprefixer jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` and `package-lock.json` update; no pnpm/yarn lockfile.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/jest.config.cjs`
- Create: `apps/web/jest.setup.ts`
- Create: `apps/web/components.json`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/forgot-password/page.tsx`
- Create: `apps/web/app/(auth)/reset-password/page.tsx`
- Create: `apps/web/app/(auth)/verify-email/page.tsx`
- Create: `apps/web/app/invite/accept/page.tsx`
- Create: `apps/web/app/app/layout.tsx`
- Create: `apps/web/app/app/settings/page.tsx`
- Create: `apps/web/lib/api-envelope.ts`
- Create: `apps/web/lib/schemas/auth.ts`
- Create: `apps/web/lib/utils.ts`
- Create: `apps/web/__tests__/root-layout.test.tsx`
- Create: `apps/web/__tests__/auth-layout.test.tsx`
- Create: `apps/web/__tests__/app-shell.test.tsx`
- Create: `apps/web/__tests__/auth-schemas.test.ts`
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/components/button.tsx`
- Create: `packages/ui/src/components/input.tsx`
- Create: `packages/ui/src/components/label.tsx`
- Create: `packages/ui/src/components/card.tsx`
- Create: `packages/ui/src/components/badge.tsx`
- Create: `packages/ui/src/__tests__/button.test.tsx`
- Create: `packages/ui/src/__tests__/input.test.tsx`
- Create: `packages/ui/src/__tests__/badge.test.tsx`

### Task 3.1: Install Approved Frontend Dependencies

- [ ] **Step 1: Install dependencies**

```bash
npm install next@15 react@19 react-dom@19 zod lucide-react class-variance-authority clsx tailwind-merge
npm install -D @types/react @types/react-dom tailwindcss@3 postcss autoprefixer jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: npm updates root dependency files only.

### Task 3.2: Scaffold Web And UI Packages

- [ ] **Step 1: Add root scripts**

Modify `package.json`:

```json
"web:typecheck": "tsc -p apps/web/tsconfig.json --noEmit",
"web:lint": "npm run web:typecheck",
"web:test": "jest --config apps/web/jest.config.cjs",
"web:build": "next build apps/web",
"ui:typecheck": "tsc -p packages/ui/tsconfig.json --noEmit",
"ui:test": "jest --config apps/web/jest.config.cjs packages/ui"
```

Update:

```json
"lint": "npm run api:typecheck && npm run ui:typecheck && npm run web:typecheck",
"test": "npm run api:test && npm run web:test",
"test:cov": "npm run api:test:cov"
```

- [ ] **Step 2: Run expected red checks**

```bash
npm run web:typecheck
npm run ui:typecheck
```

Expected: FAIL because `apps/web` and `packages/ui` do not exist.

- [ ] **Step 3: Create minimal strict configs**

Create web and UI package files with strict TS:

- `strict: true`
- `noImplicitAny: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

Configure imports:

- `@/*` for `apps/web/*`
- `@omnichat/ui` for shared UI package

- [ ] **Step 4: Verify package scaffolds**

```bash
npm run web:typecheck
npm run ui:typecheck
```

Expected: PASS.

### Task 3.3: Design Tokens And Tailwind/shadcn Conventions

- [ ] **Step 1: Write token/build smoke test**

Create `root-layout.test.tsx` to assert root layout renders and applies font class names without importing non-existent routes.

Run:

```bash
npm run web:test -- apps/web/__tests__/root-layout.test.tsx
```

Expected: FAIL until layout exists.

- [ ] **Step 2: Implement globals, Tailwind, fonts**

Create `apps/web/app/globals.css` with variables:

- `--background: #FFFFFF`
- `--foreground: #16182B`
- `--card: #FFFFFF`
- `--card-border: #E8E9F0`
- `--secondary: #F7F7FB`
- `--muted-foreground: #767A8C`
- `--muted-foreground-light: #9A9DB0`
- `--primary: #4338CA`
- `--primary-hover: #372FA3`
- `--primary-soft: #EEF0FF`
- `--success: #1F9D72`
- `--success-soft: #E8F6EF`
- `--warning: #D97706`
- `--danger: #DC4444`

Configure Tailwind mappings. Use `next/font/google`:

- Plus Jakarta Sans weight `500`
- Inter weights `400`, `500`
- JetBrains Mono weight `400`

Do not use font weight `700`.

- [ ] **Step 3: Verify build**

```bash
npm run web:test -- apps/web/__tests__/root-layout.test.tsx
npm run web:build
```

Expected: PASS.

### Task 3.4: Shared UI Primitives

- [ ] **Step 1: Write failing UI tests**

Create tests:

- Button renders children and disabled state
- Input forwards props and placeholder
- Badge applies semantic variant classes

Run:

```bash
npm run ui:test
```

Expected: FAIL because components do not exist.

- [ ] **Step 2: Implement primitives**

Create:

- `Button` variants: `primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`
- `Input`
- `Label`
- `Card`
- `Badge` variants: `primary`, `success`, `warning`, `danger`, `muted`

Use shadcn-style `cn()` helper with `clsx` and `tailwind-merge`. Use `class-variance-authority` for variants. Use 8px radius for buttons/inputs/badges, 12px for cards, 1px borders, no shadows.

- [ ] **Step 3: Verify UI tests**

```bash
npm run ui:test
npm run ui:typecheck
```

Expected: PASS.

### Task 3.5: Auth Layout Foundation

- [ ] **Step 1: Write failing auth layout/schema tests**

Create tests:

- auth pages render centered card shell
- invalid email fails Zod validation
- too-short password fails Zod validation
- valid login shape passes Zod validation

Run:

```bash
npm run web:test -- apps/web/__tests__/auth-layout.test.tsx apps/web/__tests__/auth-schemas.test.ts
```

Expected: FAIL until routes/schemas exist.

- [ ] **Step 2: Implement auth routes and schemas**

Create route shells:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/invite/accept`

Layout:

- centered card
- width `360px`
- responsive max width `calc(100vw - 32px)`
- no decorative imagery
- primary square logo mark
- labels 12px
- full-width primary button
- links in primary color

Create Zod schemas in `apps/web/lib/schemas/auth.ts`.

- [ ] **Step 3: Verify auth tests**

```bash
npm run web:test -- apps/web/__tests__/auth-layout.test.tsx apps/web/__tests__/auth-schemas.test.ts
```

Expected: PASS.

### Task 3.6: App Shell Foundation

- [ ] **Step 1: Write failing app shell test**

Create test:

- icon rail exists with 56px width
- nav items render: Inbox, Customers, Reports, Knowledge, Settings
- future-stage items are disabled/greyed
- Settings route content renders

Run:

```bash
npm run web:test -- apps/web/__tests__/app-shell.test.tsx
```

Expected: FAIL until app shell exists.

- [ ] **Step 2: Implement app shell**

Create `/app/settings` foundation with `lucide-react` icons. Do not create tenant-scoped data. Do not implement inbox.

- [ ] **Step 3: Verify app shell**

```bash
npm run web:test -- apps/web/__tests__/app-shell.test.tsx
```

Expected: PASS.

### Task 3.7: API Envelope Types

- [ ] **Step 1: Create envelope types**

Create `apps/web/lib/api-envelope.ts`:

- `ApiSuccess<T>`
- `ApiError`
- `ApiResponse<T>`
- `ApiMeta`

`details` type must be `unknown`, not `any`.

- [ ] **Step 2: Verify strict types**

```bash
npm run web:typecheck
```

Expected: PASS.

### Task 3.8: Batch 3 Verification

- [ ] **Step 1: Run verification**

```bash
npm run lint
npm run api:build
npm run api:test
npm run test:cov
npm run web:typecheck
npm run web:test
npm run web:build
npm run ui:typecheck
npm run ui:test
```

Expected: all pass. No Prisma migration. No backend endpoint change.

- [ ] **Step 2: Checkpoint D report**

Report:

- changed files
- tests run
- frontend scripts added
- tenant isolation remains backend-only
- RBAC remains backend source of truth
- no audit/PlanLimit changes
- residual risks

---

## Final Verification: Checkpoint E

- [ ] **Step 1: Run complete verification**

```bash
npm run prisma:validate
npm run lint
npm run api:build
npm run api:test
npm run test:cov
npm run api:test:e2e
npm run web:typecheck
npm run web:test
npm run web:build
npm run ui:typecheck
npm run ui:test
```

Expected:

- all available commands pass
- unavailable scripts are explicitly reported
- coverage status is reported with exact result
- no Stage 2+ code is present
- no unapproved dependencies are present

- [ ] **Step 2: Final report**

Report:

- final test results
- changed files
- migration status
- docs updated
- tenant isolation status
- RBAC status
- audit status
- PlanLimit status
- readiness to merge

---

## Completion: Checkpoint F

After Checkpoint E, founder chooses one:

1. Merge to `main`
2. Open a PR
3. Keep the branch for more review
4. Discard the branch

No merge, PR, or discard happens without explicit founder decision.

---

## Publish: Checkpoint G

Founder decision: publish Stage 1 Foundation to `main` only.

- [x] `codex/stage-1-backend-security` fast-forward merged into local `main`
- [x] fresh verification run on `main`
- [x] secret scan before publish
- [x] push `main` to GitHub
- [x] report deploy readiness and next stage
