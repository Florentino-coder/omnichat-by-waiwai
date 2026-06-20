# Phase B — Scenario Engine Design

Date: 2026-06-21  
Stage: Pre-Automation (Zaapi parity path)  
Status: Implemented

## Goal

Give tenants rule-based AI scenarios (intent keywords/tags → custom instructions + optional actions) before building a full visual workflow canvas.

## Scope (In)

- `AiScenario` model (tenant-scoped, optional LINE channel scope)
- CRUD API: `GET/POST/PATCH/DELETE /api/v1/ai/scenarios`
- Keyword + tag matching with priority ordering
- Active hours window (Bangkok timezone, 0–23)
- Inject `{{scenario_instructions}}` into `aiSuggest` and `aiTest`
- Inbound LINE text message hook → auto tag / assign / priority
- Settings UI tab: **Scenarios**
- Audit: `AI_SCENARIO_CREATED`, `UPDATED`, `DELETED`, `MATCHED`

## Scope (Out — later phases)

- Visual flow canvas (Phase E)
- BullMQ automation chains (Phase C)
- Auto-reply without agent (Phase F)

## Data Model

```prisma
model AiScenario {
  tenantId, lineChannelId?, name, priority, isEnabled
  triggerKeywords[], triggerTagNames[]
  activeHourStart?, activeHourEnd?
  instructions
  actionAddTagName?, actionAssignMemberId?
  actionSetPriority?, actionEscalate
}
```

## Matching Rules

1. Load enabled scenarios for tenant (+ global + channel-specific)
2. Filter: channel scope, active hours
3. Keywords: at least one keyword in message (if keywords configured)
4. Tags: at least one tag match (if tag triggers configured)
5. Both keyword and tag groups must pass when both configured (AND)
6. At least one trigger type required
7. Pick lowest `priority` value (first match wins)

## Runtime

### Inbound message (LINE webhook)

After text message saved → `processInboundMessage` → apply actions (tag, assign, priority) + audit `AI_SCENARIO_MATCHED`

### AI suggest / test

- Match scenario from recent inbound text + draft
- Apply actions (idempotent) on suggest
- Inject instructions into prompt via `{{scenario_instructions}}`

## RBAC

| Action | OWNER | ADMIN | AGENT | QC | VIEWER |
|--------|-------|-------|-------|-----|--------|
| View   | ✅    | ✅    | ✅    | ✅  | ✅     |
| Create | ✅    | ✅    | ❌    | ❌  | ❌     |
| Edit   | ✅    | ✅    | ❌    | ❌  | ❌     |
| Delete | ✅    | ✅    | ❌    | ❌  | ❌     |

## Testing

- `scenario-match.util.spec.ts` — match logic, hours, priority pick
- `scenario.service.spec.ts` — CRUD audit, RBAC, action apply
- `inbox.service.spec.ts` — mock `ScenarioService`

## Next

Phase C — Automation v1 (trigger → action chain with BullMQ)

## Success Criteria

- [x] Admin can CRUD scenarios from Settings
- [x] AI suggest/test inject matched scenario instructions
- [x] Inbound message can auto-tag/assign/escalate
- [x] Tenant isolation on all queries
- [x] Audit log on CRUD and match actions
