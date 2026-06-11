# AGENTS.md — OmniChat SaaS

> This file is the source of truth for every Codex/AI session.
> Read this ENTIRE file before writing any code.
> Never deviate from the rules below without explicit founder approval.

---

## Project Overview

**Name:** OmniChat SaaS
**Type:** Multi-Tenant Customer Service Platform
**Target:** Thai SME & Enterprise
**Stack:** NestJS + Next.js + PostgreSQL + Redis + BullMQ

---

## Tech Stack (Locked Versions)

### Backend
```
Runtime:      Node.js 20 LTS
Framework:    NestJS 10
Language:     TypeScript 5.x (strict mode)
ORM:          Prisma 5.x
Database:     PostgreSQL 16
Cache:        Redis 7
Queue:        BullMQ 5
Realtime:     Socket.IO 4
Search:       OpenSearch 2
Storage:      MinIO (S3-compatible)
```

### Frontend
```
Framework:    Next.js 15 (App Router)
UI Library:   React 19
Language:     TypeScript 5.x (strict mode)
Styling:      TailwindCSS 3.x
Components:   shadcn/ui
State:        Zustand
Data Fetch:   TanStack Query v5
Forms:        React Hook Form + Zod
```

### Infrastructure
```
Container:    Docker + Docker Compose
Deploy:       Coolify (self-hosted)
Monitor:      Grafana + Prometheus
```

---

## Repository Structure

```
/
├── apps/
│   ├── web/          ← Next.js frontend
│   └── api/          ← NestJS backend
├── packages/
│   ├── ui/           ← Shared shadcn components
│   ├── types/        ← Shared TypeScript types/DTOs
│   └── shared/       ← Shared utilities/constants
├── docs/
│   ├── prd/
│   ├── architecture/
│   ├── database/
│   ├── api/
│   └── security/
├── prisma/
│   └── schema.prisma ← SINGLE SOURCE OF TRUTH for DB
├── scripts/
├── AGENTS.md         ← THIS FILE
└── docker-compose.yml
```

---

## Multi-Tenant Architecture Rules

> These rules are NON-NEGOTIABLE. Every violation is a security bug.

### Rule 1 — tenant_id on Every Business Table
```prisma
model AnyBusinessTable {
  id        String   @id @default(uuid())
  tenantId  String   // REQUIRED — never optional
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  ...
}
```

### Rule 2 — Every Query Must Filter by tenantId
```typescript
// WRONG
const conversations = await prisma.conversation.findMany();

// CORRECT
const conversations = await prisma.conversation.findMany({
  where: { tenantId: ctx.tenantId },
});
```

### Rule 3 — TenantGuard on Every Protected Route
```typescript
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.AGENT)
@Get('conversations')
findAll(@TenantCtx() ctx: TenantContext) { ... }
```

### Rule 4 — Never Join Across Tenants
Cross-tenant queries are forbidden. Period.

---

## Authentication Rules

- **JWT** access token: 15 min expiry
- **Refresh token**: 7 days, stored in Redis, rotated on use
- **2FA**: TOTP (optional at Stage 1, enforced at Stage 9)
- **Secrets**: stored encrypted in DB (AES-256), never in plaintext
- **Passwords**: bcrypt, saltRounds=12

---

## RBAC Roles (Fixed Enum)

```typescript
enum Role {
  OWNER   = 'OWNER',    // Full access, billing, delete tenant
  ADMIN   = 'ADMIN',    // All ops, manage users
  AGENT   = 'AGENT',    // Handle conversations
  QC      = 'QC',       // Read-only + scoring
  VIEWER  = 'VIEWER',   // Read-only reports
}
```

Never add roles without updating the Permission Matrix in `/docs/security/permission-matrix.md`.

---

## Database Conventions

```prisma
// All tables follow this pattern
model TableName {
  id         String    @id @default(uuid())   // UUID v4
  tenantId   String                           // FK to tenants
  // ... business fields ...
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  deletedAt  DateTime?                        // soft delete
}
```

- **IDs**: UUID (never auto-increment integer)
- **Timestamps**: always `createdAt`, `updatedAt`
- **Soft Delete**: `deletedAt DateTime?` — never hard delete business data
- **Migrations**: always use `prisma migrate dev --name descriptive-name`
- **Never** edit migration files manually after they are applied

---

## API Conventions

### URL Pattern
```
/api/v1/{resource}           GET (list), POST (create)
/api/v1/{resource}/:id       GET (one), PATCH (update), DELETE (soft)
```

### Response Envelope
```typescript
// Success
{
  success: true,
  data: T,
  meta?: { page, limit, total }
}

// Error
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable',
    details?: any
  }
}
```

### HTTP Status Codes
```
200 — OK
201 — Created
400 — Bad Request (validation)
401 — Unauthorized
403 — Forbidden (RBAC)
404 — Not Found
409 — Conflict
422 — Unprocessable Entity
429 — Rate Limited
500 — Internal Server Error
```

---

## Testing Rules

Every module must have:
1. **Unit tests** for service layer (Jest)
2. **Integration tests** for API endpoints (Supertest)
3. **E2E tests** for critical flows (multi-tenant isolation, auth)

```bash
# Run all tests
pnpm test

# Run with coverage (must be > 80%)
pnpm test:cov

# E2E
pnpm test:e2e
```

---

## Code Quality Rules

```jsonc
// tsconfig.json (both apps)
{
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

- **Never** use `any` type — use `unknown` if needed
- **Never** use `console.log` in production code — use NestJS Logger
- **Never** commit secrets to git
- **Always** validate input with class-validator DTOs (backend)
- **Always** validate with Zod (frontend)
- ESLint + Prettier enforced via pre-commit hooks

---

## Stage Scope Reference

| Stage | Name             | Status     |
|-------|------------------|------------|
| 0     | Architecture     | 🔵 Planning |
| 1     | Foundation       | ⏳ Todo     |
| 2     | LINE OA          | ⏳ Todo     |
| 3     | Unified Inbox    | ⏳ Todo     |
| 4     | Customer CRM     | ⏳ Todo     |
| 5     | Knowledge System | ⏳ Todo     |
| 6     | Reporting        | ⏳ Todo     |
| 7     | KPI Engine       | ⏳ Todo     |
| 8     | QC Center        | ⏳ Todo     |
| 9     | Audit Log        | ⏳ Todo     |
| 10    | Automation       | ⏳ Todo     |
| 11    | Search           | ⏳ Todo     |
| 12    | AI Copilot       | ⏳ Todo     |
| 13    | RAG System       | ⏳ Todo     |
| 14    | AI QA            | ⏳ Todo     |
| 15    | Hybrid AI Agent  | ⏳ Todo     |
| 16    | Full AI Agent    | ⏳ Todo     |
| 17    | Billing          | ⏳ Todo     |
| 18    | Multi-Channel    | ⏳ Todo     |

---

## Codex Workflow (Mandatory)

```
1. Read AGENTS.md
2. Read relevant /docs files for the stage
3. Design → show plan to founder for review
4. Implement (scope-locked, no extras)
5. Write tests
6. Update /docs if schema/API changed
7. Report what was done and what's next
```

**NEVER build outside the assigned stage scope.**
**ALWAYS ask before adding new dependencies.**
**ALWAYS run tests before marking a task complete.**

---

## How to Start a Session

Paste this at the beginning of every Codex session:

```
Read AGENTS.md first.
Current stage: [STAGE NUMBER]
Task: [SPECIFIC TASK]
Reference files: [LIST FILES]
Do not touch anything outside the task scope.
```

---

## Environment Variables

```bash
# apps/api/.env (template — actual values in Coolify secrets)
DATABASE_URL="postgresql://user:pass@localhost:5432/omnichat"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
ENCRYPTION_KEY="..."        # AES-256 key for stored secrets
MINIO_ENDPOINT="..."
MINIO_ACCESS_KEY="..."
MINIO_SECRET_KEY="..."
```

---

_Last updated: 2026 | Owner: Solo Founder_
