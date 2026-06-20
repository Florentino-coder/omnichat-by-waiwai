# Phase C — Automation v1 Design

Date: 2026-06-21  
Stage: Pre-Automation (Zaapi parity path)  
Status: Implemented

## Goal

Give tenants list-based workflow automation: trigger → ordered action chain, executed via BullMQ (inline fallback in dev/test).

## Scope (In)

- `AutomationRule` + `AutomationRun` models
- CRUD API: `GET/POST/PATCH/DELETE /api/v1/automation/rules`
- Triggers: `MESSAGE_RECEIVED`, `CONVERSATION_CREATED`, `TAG_ADDED`, `STATUS_CHANGED`, `OFF_HOURS`
- Step types: `ADD_TAG`, `ASSIGN_AGENT`, `SET_PRIORITY`, `SEND_TEXT_REPLY`, `SEND_SAVED_REPLY`, `WAIT`, `CLOSE_CONVERSATION`, `ESCALATE`
- BullMQ queue `automation-runs` with inline processor fallback
- Dispatch hooks: LINE webhook + inbox tag/status changes
- Settings UI tab: **Automation**
- Audit: `AUTOMATION_RULE_*`, `AUTOMATION_RUN_*`, `AUTOMATION_STEP_EXECUTED`

## Scope (Out — later phases)

- `AI_SUGGEST` / `AI_AUTO_REPLY` steps (Phase F)
- Visual flow canvas (Phase E)
- Plan-gated auto-reply credits (Phase F + Billing)

## Data Model

```prisma
model AutomationRule {
  tenantId, lineChannelId?, name, priority, isEnabled
  triggerType, triggerKeywords[], triggerTagNames[]
  triggerStatus?, offHourStart?, offHourEnd?
  steps Json  // ordered action array
}

model AutomationRun {
  tenantId, ruleId, conversationId
  status, currentStepIndex, context?, errorMessage?
}
```

## Matching Rules

1. Load enabled rules for tenant (+ global + channel-specific)
2. Filter by `triggerType` + channel
3. Apply trigger-specific filters (keywords, tag, status, off-hours)
4. All matching rules enqueue separate runs sorted by priority

## Runtime

1. Event occurs → `AutomationService.dispatchEvent`
2. Create `AutomationRun` → enqueue step 0
3. `AutomationEngineService.processRunStep` executes step
4. `WAIT` schedules delayed job; other steps chain immediately
5. Audit each step + run lifecycle

## RBAC

| Action | OWNER | ADMIN | AGENT | QC | VIEWER |
|--------|-------|-------|-------|-----|--------|
| View   | ✅    | ✅    | ✅    | ✅  | ✅     |
| Create | ✅    | ✅    | ❌    | ❌  | ❌     |
| Edit   | ✅    | ✅    | ❌    | ❌  | ❌     |
| Delete | ✅    | ✅    | ❌    | ❌  | ❌     |

## Example: Off-hours auto-reply

```
Trigger: OFF_HOURS (business 9-18 Bangkok)
Steps:
  1. SEND_TEXT_REPLY "ร้านปิดแล้วนะคะ จะติดต่อกลับเช้านี้"
  2. ADD_TAG "off-hours"
  3. SET_PRIORITY HIGH
```

## Next

Phase D — RAG proper (embeddings + document upload)

## Success Criteria

- [x] Admin can CRUD automation rules from Settings
- [x] Off-hours / message / tag / status triggers dispatch runs
- [x] Steps execute in order with WAIT support
- [x] Tenant isolation on all queries
- [x] Audit log on CRUD, steps, and run lifecycle
