# Stage 13 — Audit Log (Tenant UI)

Date: 2026-06-24  
Status: Approved  
Depends on: Stage 1 audit scaffold, Stages 2–11 audit writes

---

## Goal

Give OWNER/ADMIN a **tenant-scoped, immutable audit trail viewer** in the web app. Today logs are written across the platform but only exposed via a minimal `GET /audit-logs` (last 100, no filters, no UI).

Roadmap: *Immutable trace for auth, replies, deletes, assignments, exports, settings.*

---

## Scope (v1)

| In scope | Out of scope |
|----------|--------------|
| Paginated list with date/action/category filters | Delete or edit audit rows |
| Actor display (user displayName / system) | SuperAdmin cross-tenant viewer |
| CSV export (OWNER only) | Real-time websocket feed |
| Page `/app/settings/audit-logs` | Full-text search in metadata JSON |
| Thai + English action labels | Stage 14 SLA automation |

---

## API

### `GET /api/v1/audit-logs`

**Roles:** OWNER, ADMIN (tenant-scoped)

**Query:**

| Param | Type | Notes |
|-------|------|-------|
| `page` | int | default 1 |
| `limit` | int | default 50, max 100 |
| `from` | ISO date | inclusive start |
| `to` | ISO date | inclusive end |
| `action` | AuditAction | exact match |
| `category` | string | `auth`, `conversation`, `ai`, `knowledge`, `automation`, `line`, `settings`, `backup` |
| `userId` | uuid | actor filter |

**Response:**

```json
{
  "success": true,
  "data": [{ "id", "action", "targetType", "targetId", "metadata", "createdAt", "actor": { "id", "displayName", "email" } | null }],
  "meta": { "page", "limit", "total" }
}
```

Backward-compatible: existing clients calling without query still get page 1.

### `GET /api/v1/audit-logs/export`

**Roles:** OWNER only

Same query filters; returns `text/csv` attachment (max 10,000 rows).

---

## UI

- Route: `/app/settings/audit-logs` (link from Settings → Team/Security group)
- Table: time, actor, action (localized), target, details snippet
- Filters: date range presets (7d/30d), category, optional action
- Pagination controls
- Export CSV button (OWNER only)

---

## Security

- Every query filters `tenantId` from JWT — no cross-tenant reads
- Immutable: no DELETE/PATCH endpoints
- Export capped at 10k rows per request

---

## Testing

- Unit: `AuditLogsService` filters, pagination, CSV
- RBAC: AGENT/QC/VIEWER → 403; export ADMIN → 403
- Tenant isolation: existing e2e extended for query params

---

## Success criteria

- [ ] OWNER/ADMIN can browse audit history in web UI
- [ ] AI auto-reply events visible under AI category
- [ ] OWNER can export CSV for compliance
- [ ] Tests pass; no schema migration required
