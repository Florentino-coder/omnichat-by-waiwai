# PRD — Stage 0: Architecture

**Project:** OmniChat SaaS
**Stage:** 0 — Architecture Only (No Code)
**Version:** 1.0
**Owner:** Solo Founder

---

## Objective

Stage 0 produces all design documents required before any code is written. Nothing is implemented. Every decision is documented and reviewed before moving to Stage 1.

---

## Deliverables Checklist

- [x] PRD (this document)
- [x] Permission Matrix (`docs/security/permission-matrix.md`)
- [x] ER Diagram Stage 1 (`docs/database/er-diagram-stage1.mermaid`)
- [x] Prisma Schema Stage 1 (`prisma/schema.prisma`)
- [x] AGENTS.md (root)
- [ ] System Architecture Diagram
- [x] API Specification — Stage 1 Endpoints
- [x] Security Design Document
- [x] UI Sitemap
- [x] Sprint Roadmap with time estimates

---

## System Overview

### What is OmniChat?

OmniChat is a multi-tenant customer service SaaS platform designed for Thai SMEs and enterprises. It centralizes customer communication from LINE OA (and later Facebook, Instagram, WhatsApp) into a single intelligent inbox, with agent management, KPI tracking, QC workflows, and AI assistance.

### Core Value Propositions

1. **Unified Inbox** — all customer messages in one place
2. **Team Management** — assign, track, and evaluate agents
3. **AI Assistance** — suggestions, summaries, auto-replies
4. **Business Insights** — KPIs, reports, QC scoring
5. **Multi-Tenant SaaS** — one platform, many companies

---

## Multi-Tenant Architecture

### Tenant Isolation Strategy

**Database:** Row-level isolation via `tenant_id` on every business table. No shared tables without tenant scoping.

**API:** Every request is scoped to a tenant via JWT claims. TenantGuard middleware enforces this on every route.

**Data:** Tenants cannot see each other's data under any circumstances.

### Tenant Hierarchy

```
Tenant (Company)
└── Workspace (Department/Team)
    └── WorkspaceMember (User + Role in that workspace)
```

A user can belong to multiple workspaces within the same tenant, with potentially different roles in each.

### Onboarding Flow

```
1. Founder creates Tenant (slug, name)
2. System auto-creates Owner user + default Workspace
3. Owner invites Admin/Agent via email
4. Invitee clicks link → creates account → joins Workspace
```

---

## Stage 1 Scope

### Included

- Tenant CRUD (create, read, update, soft delete)
- Tenant Settings
- User registration + login (email/password)
- JWT auth (access + refresh token rotation)
- Email verification
- Password reset flow
- Workspace management
- Role-based invitation system (OWNER, ADMIN, AGENT, QC, VIEWER)
- RBAC enforcement on all routes
- Audit logging for auth + user events
- Basic 2FA setup (TOTP, optional)

### Explicitly Excluded from Stage 1

- LINE OA, messaging, conversations
- Dashboard, reports
- Any AI features
- Billing
- Search

---

## API Specification — Stage 1

### Auth Endpoints

```
POST   /api/v1/auth/register          Create account (from invitation token)
POST   /api/v1/auth/login             Email + password → JWT pair
POST   /api/v1/auth/refresh           Refresh access token
POST   /api/v1/auth/logout            Revoke refresh token
POST   /api/v1/auth/forgot-password   Send reset email
POST   /api/v1/auth/reset-password    Consume token + set new password
POST   /api/v1/auth/verify-email      Verify email address
POST   /api/v1/auth/2fa/setup         Generate TOTP secret + QR code
POST   /api/v1/auth/2fa/verify        Verify TOTP code + enable 2FA
POST   /api/v1/auth/2fa/disable       Disable 2FA (requires TOTP verify)
```

### Tenant Endpoints

```
POST   /api/v1/tenants                Create tenant (super admin only)
GET    /api/v1/tenants/me             Get current tenant info
PATCH  /api/v1/tenants/me            Update tenant info
GET    /api/v1/tenants/me/settings   Get tenant settings
PATCH  /api/v1/tenants/me/settings   Update tenant settings
```

### Workspace Endpoints

```
GET    /api/v1/workspaces             List workspaces in tenant
POST   /api/v1/workspaces             Create workspace
GET    /api/v1/workspaces/:id         Get workspace
PATCH  /api/v1/workspaces/:id         Update workspace
DELETE /api/v1/workspaces/:id         Soft delete workspace
```

### User Management Endpoints

```
GET    /api/v1/users/me               Get own profile
PATCH  /api/v1/users/me               Update own profile
GET    /api/v1/workspaces/:id/members List workspace members
PATCH  /api/v1/workspaces/:id/members/:userId  Change role
DELETE /api/v1/workspaces/:id/members/:userId  Remove member
```

### Invitation Endpoints

```
POST   /api/v1/invitations            Send invitation email
GET    /api/v1/invitations            List invitations (pending/accepted)
DELETE /api/v1/invitations/:id        Revoke invitation
GET    /api/v1/invitations/verify/:token  Verify invitation token (public)
POST   /api/v1/invitations/accept/:token  Accept invitation (creates user)
```

### Audit Log Endpoints

```
GET    /api/v1/audit-logs             List audit logs (OWNER/ADMIN only)
```

---

## Security Design

### Authentication Flow

```
Login Request
↓
Validate email + password (bcrypt compare)
↓
Check emailVerified, isActive, not soft-deleted
↓
If 2FA enabled → require TOTP code
↓
Generate access token (JWT, 15min, includes tenantId + role)
Generate refresh token (random bytes, hashed, store in Redis + DB)
↓
Return { accessToken, refreshToken }
```

### Refresh Token Rotation

```
Client sends refreshToken
↓
Verify token not revoked (Redis lookup by hash)
↓
Issue new accessToken + new refreshToken
↓
Revoke old refreshToken immediately
↓
If old refreshToken used again → revoke ALL tokens for user (theft detection)
```

### Secrets Storage

Sensitive values (LINE channel secrets, 2FA secrets, API keys for AI) are:
1. Encrypted with AES-256-GCM before storing in DB
2. Key stored in environment variable (`ENCRYPTION_KEY`)
3. Never logged, never returned in API responses

### Rate Limiting

| Endpoint | Limit |
|---|---|
| POST /auth/login | 5 req/min per IP |
| POST /auth/forgot-password | 3 req/15min per email |
| POST /auth/register | 10 req/hour per IP |
| All other endpoints | 100 req/min per user |

---

## Database Design Decisions

### UUID vs Auto-increment

Decision: **UUID v4** for all primary keys.

Rationale:
- No sequential enumeration by attackers
- Safe to expose in URLs
- Works across distributed environments

### Soft Delete Pattern

All business data uses `deletedAt DateTime?`. Hard delete is reserved for compliance requests (PDPA) only, handled by a separate admin process.

### Index Strategy (Stage 1)

```sql
-- tenants
CREATE UNIQUE INDEX ON tenants(slug);
CREATE INDEX ON tenants(slug);

-- workspaces
CREATE INDEX ON workspaces(tenant_id);

-- workspace_members
CREATE UNIQUE INDEX ON workspace_members(workspace_id, user_id);
CREATE INDEX ON workspace_members(tenant_id);
CREATE INDEX ON workspace_members(user_id);

-- invitations
CREATE INDEX ON invitations(tenant_id);
CREATE INDEX ON invitations(workspace_id);
CREATE INDEX ON invitations(invited_by_user_id);
CREATE INDEX ON invitations(email);
CREATE UNIQUE INDEX ON invitations(token);
CREATE INDEX ON invitations(token);

-- refresh_tokens
CREATE INDEX ON refresh_tokens(user_id);
CREATE UNIQUE INDEX ON refresh_tokens(token_hash);

-- audit_logs
CREATE INDEX ON audit_logs(tenant_id);
CREATE INDEX ON audit_logs(user_id);
CREATE INDEX ON audit_logs(action);
CREATE INDEX ON audit_logs(created_at);
```

Note: Prisma keeps camelCase column names in the applied Stage 1 schema because the founder chose to keep the existing schema. The SQL above describes logical fields; the migration uses Prisma-generated quoted column names such as `"tenantId"`, `"workspaceId"`, and `"invitedByUserId"`.

Supabase hardening: Stage 1-A enables RLS on all public Stage 1 tables and `_prisma_migrations` without public policies. This is intentional while the backend access model is server-side Prisma/NestJS, so Supabase Data API access remains deny-by-default until a dedicated RLS policy model is approved.

---

## Email Templates Required (Stage 1)

1. **Invitation email** — invite link + expiry date
2. **Email verification** — verify your account
3. **Password reset** — reset link + expiry date
4. **Welcome email** — after successful registration

Email provider: recommend **Resend** or **AWS SES** (configure via `EMAIL_FROM`, `RESEND_API_KEY`)

---

## Frontend Sitemap (Stage 1)

```
/                           → Redirect to /login
/login                      → Login page
/forgot-password            → Forgot password form
/reset-password?token=...   → Reset password form
/verify-email?token=...     → Email verification landing
/invite/accept?token=...    → Accept invitation + create account

/app                        → App shell (requires auth)
/app/settings               → Tenant settings
/app/settings/workspace     → Workspace management
/app/settings/members       → Member list + invite
/app/settings/profile       → Own profile + 2FA
/app/settings/audit-logs    → Audit log viewer (OWNER/ADMIN)
```

---

## Success Criteria — Stage 1

Before moving to Stage 2, verify:

- [ ] Multiple companies can register and log in independently
- [ ] Data is fully isolated between tenants (verified by test suite)
- [ ] Owner can invite Admin/Agent by email
- [ ] Invitee can create account via email link
- [ ] RBAC guards work — agent cannot access admin routes
- [ ] Refresh token rotation works, stolen token triggers full revoke
- [ ] Audit log records login, logout, invite, role change events
- [ ] All endpoints return correct error codes and messages
- [ ] Test coverage > 80%
- [ ] No `any` TypeScript errors
- [ ] Docker Compose runs locally

---

## Sprint Roadmap (High-Level)

| Sprint | Focus                          | Duration |
|--------|-------------------------------|----------|
| S0     | Architecture (this doc)        | 1 week   |
| S1-A   | DB + Auth backend              | 1 week   |
| S1-B   | Tenant + Workspace + RBAC      | 1 week   |
| S1-C   | Invitation system              | 3 days   |
| S1-D   | Frontend auth flows            | 1 week   |
| S1-E   | Testing + bug fixes            | 3 days   |
| S2-A   | LINE OA connect + webhook      | 1 week   |
| S2-B   | Message sync + storage         | 1 week   |
| S3-A   | Inbox UI + Realtime (Socket)   | 2 weeks  |
| ...    | ...                            | ...      |

---

## Stage 1-A Implementation Status

- [x] Prisma schema normalized under `prisma/schema.prisma`
- [x] Initial Prisma migration applied to Supabase PostgreSQL
- [x] Seed script creates test tenant, tenant settings, default workspace, owner user, owner membership, and audit log
- [x] Supabase RLS enabled for all Stage 1 public tables with deny-by-default public access
- [x] Supabase unindexed foreign key advisor fixed for invitations
- [x] Prisma migration status verified against Supabase
- [x] Seed verified as idempotent
- [ ] Backend auth API implementation
- [ ] Backend tenant/workspace/RBAC implementation
- [ ] Invitation email flow implementation
- [ ] Stage 1 automated test suite

---

## Stage 1 Backend Checkpoint

Checkpoint 1:

- [x] `apps/api` NestJS 10 foundation scaffolded with strict TypeScript
- [x] Prisma service/module wired for server-side database access
- [x] Auth module scaffolded with login, refresh, and logout endpoints
- [x] JWT access token payload includes `tenantId`, `workspaceId`, and `role`
- [x] Refresh tokens are generated as random values and stored as SHA-256 hashes in DB
- [x] Login writes an `AuditAction.LOGIN` audit log
- [x] JWT, tenant, and roles guard skeletons added
- [x] Unit tests added for login success, invalid password rejection, and logout token revocation
- [ ] Invitation-based registration endpoint
- [ ] Redis-backed refresh token session cache
- [ ] TOTP verification implementation
- [x] Tenant `me` and settings endpoints scaffolded with tenant-scoped service queries
- [x] Workspace CRUD endpoints scaffolded with tenant-scoped service queries
- [x] Workspace member list, role update, and remove endpoints scaffolded with RBAC guards
- [x] Unit tests added for tenant scope, workspace scope, and member role update scope
- [ ] Full RBAC integration tests and e2e tenant isolation tests

Dependency checkpoint: npm audit reports high-severity transitive findings in the locked NestJS 10 / tooling dependency chain. npm's proposed fix upgrades to NestJS 11, which is outside the locked Stage 1 stack and requires founder approval before changing.

---

## Open Decisions (Founder Must Decide Before Stage 1)

1. **Subdomain vs path routing for tenants?**
   - Option A: `acme.omnichat.com` (subdomain per tenant) — cleaner but DNS complexity
   - Option B: `omnichat.com/app/acme` (path-based) — simpler, recommended for v1

2. **Email provider?**
   - Resend (simpler API) vs AWS SES (cheaper at scale)

3. **Initial deployment: Coolify on VPS or managed cloud?**

4. **Support for multiple workspaces per tenant in Stage 1?**
   - Or keep it simple: 1 tenant = 1 workspace initially

---

_Last updated: 2026 | Stage 0 Architecture Document_
