# Superpowers Integration — Codex Workflow Addendum

Version: 2026-v1
Status: Proposed — pending founder approval before Codex installs/uses this
Applies on top of: `AGENTS.md`, `omnichat-master-plan-addendum-v2.md`

> Purpose: adopt the [Superpowers](https://github.com/obra/superpowers) agentic
> skills framework (MIT license) as the implementation methodology Codex uses
> for OmniChat tasks, without losing any of the rules already in `AGENTS.md`.

---

## 1. What Superpowers Is

A plugin that gives a coding agent a structured workflow:

1. **brainstorming** — before any code, refines the request into a spec via questions, shown in reviewable chunks.
2. **writing-plans** — breaks the approved spec into bite-sized tasks (2-5 min each) with exact file paths and verification steps.
3. **subagent-driven-development** (or **executing-plans**) — dispatches a fresh subagent per task, with two-stage review (spec compliance, then code quality).
4. **test-driven-development** — strict RED-GREEN-REFACTOR; deletes code written before its test.
5. **requesting-code-review / receiving-code-review** — structured review between tasks, severity-ranked issues.
6. **using-git-worktrees / finishing-a-development-branch** — isolated branch per unit of work, then merge/PR/discard decision.

It has an official Codex CLI plugin.

## 2. Installation (Codex CLI)

```
/plugins
```
Search `superpowers`, select **Install Plugin**.

## 3. Mapping to the Existing AGENTS.md Workflow

`AGENTS.md` already defines a "Codex Workflow (Mandatory)" — Superpowers operationalizes the same steps as enforced skills rather than loose instructions. Nothing in `AGENTS.md` is replaced; this is how each step gets executed.

| AGENTS.md step | Superpowers skill(s) | Notes |
|---|---|---|
| 1. Read AGENTS.md | — (unchanged, still first) | |
| 2. Read relevant `/docs` for the stage | `using-superpowers` (orientation) | feeds context into brainstorming |
| 3. Design → show plan to founder for review | `brainstorming` + `writing-plans` | output saved under `docs/` per existing structure, not Superpowers' default location |
| 4. Implement (scope-locked, no extras) | `using-git-worktrees` + `subagent-driven-development` | one worktree/branch per task |
| 5. Write tests | `test-driven-development` | aligns with the existing ">80% coverage" rule in AGENTS.md |
| (new) | `requesting-code-review` / `receiving-code-review` | inserted between implementation and "mark complete" |
| 6-7. Update docs, report what's done/next | `finishing-a-development-branch` | merge/PR/keep/discard decision surfaced to founder |

## 4. New Rule for AGENTS.md — "Quality & Compliance Rules"

Append:

```markdown
- All Stage tasks follow the Superpowers workflow: brainstorming →
  writing-plans → subagent-driven-development → test-driven-development →
  requesting-code-review → finishing-a-development-branch.
- Design docs produced by brainstorming/writing-plans are saved under the
  existing /docs structure (docs/architecture, docs/api, etc.), not
  Superpowers' default paths.
- Founder approval is required at the writing-plans checkpoint — Codex must
  present the plan in sections and wait for explicit sign-off before any
  subagent begins implementation. This satisfies the "Founder owns ...
  final decisions" rule in the Roles section.
```

## 5. Suggested First Application — Stage 1 Remaining Checkpoint

Per the Stage 1 Backend Checkpoint in `stage-0.md`, these items are still open:

- Email provider integration for invitation/reset emails
- Redis-backed refresh token session cache
- TOTP verification implementation
- Full RBAC integration tests + e2e tenant isolation tests
- Billing Lite (`omnichat-master-plan-addendum-v2.md` §2-4)
- Frontend design tokens (`omnichat-master-plan-addendum-v2.md` §10)

Run `brainstorming` + `writing-plans` across this list as one batch, producing one plan with sections per item, then `subagent-driven-development` per section.

The Stage 1 scope remains exactly the six items above. Do not add new Stage 1 features while executing this addendum unless the founder explicitly approves a separate scope change.

## 6. Operating Procedure and Checkpoints

Use this procedure every time Codex applies Superpowers to the Stage 1 remaining checkpoint. The plan stays the same; this section only defines how to execute it completely and safely.

### 6.1 Session Start

1. Read `AGENTS.md` in full.
2. Read this file in full.
3. Read the Stage 1 reference files named in the session prompt:
   - `docs/prd/stage-0.md`
   - `docs/security/permission-matrix.md`
   - `omnichat-master-plan-addendum-v2.md`
   - `prisma/schema.prisma`
4. Confirm the current task belongs to Stage 1 and is one of the six open items in §5.
5. Stop and ask the founder before continuing if the task would start Stage 2+ work, add a dependency, add a new role, or change the locked tech stack.

**Checkpoint A — Scope lock:** Codex reports the exact Stage 1 item(s) being worked on, the files read, and anything blocked by missing information. No implementation starts before this checkpoint is acknowledged.

### 6.2 Brainstorming Output

Run `brainstorming` once for the selected Stage 1 item or batch. The output must be a short implementation spec, not code.

The spec must include:

- Problem statement
- In-scope behavior
- Out-of-scope behavior
- Tenant isolation requirements
- RBAC requirements
- Audit log requirements for mutating endpoints
- PlanLimit checks for tenant-scoped counted resources
- Data model/API impact
- Test strategy
- Open questions for founder approval

**Checkpoint B — Spec approval:** Codex presents the spec in reviewable sections and waits for explicit founder approval before creating the implementation plan.

### 6.3 Plan Output

Run `writing-plans` only after Checkpoint B passes. Save the plan under the existing `docs/` structure, choosing the closest matching folder:

| Plan type | Save under |
|---|---|
| Product/stage plan | `docs/prd/` |
| Backend architecture or service plan | `docs/architecture/` |
| Database/schema plan | `docs/database/` |
| API contract plan | `docs/api/` |
| Auth, RBAC, tenant isolation, audit | `docs/security/` |

The plan must contain one section per Stage 1 item being implemented. Each section must include:

- Exact files to create or modify
- Exact tests to create or modify
- RED-GREEN-REFACTOR steps
- Commands to run
- Expected pass/fail result at each step
- Documentation updates required
- Commit point for that section

**Checkpoint C — Plan approval:** Codex shows the full saved plan path and a concise section summary. Implementation cannot begin until the founder explicitly approves the plan.

### 6.4 Implementation Execution

After Checkpoint C, use `using-git-worktrees` to isolate the work unless the founder explicitly chooses inline execution in the current worktree.

For each approved plan section:

1. Create or switch to a branch named `codex/stage-1-<short-task-name>`.
2. Run `test-driven-development`.
3. Write the failing unit/integration/e2e test first.
4. Run the targeted test and confirm it fails for the expected reason.
5. Implement the smallest code change that makes the test pass.
6. Run the targeted test again and confirm it passes.
7. Refactor only inside the approved scope.
8. Update docs if schema, API, permission, or workflow behavior changed.
9. Run `requesting-code-review`.
10. Fix all valid review findings before moving to the next section.

**Checkpoint D — Section complete:** Codex reports tests run, docs updated, audit/PlanLimit/RBAC/tenant isolation checks, and any residual risk before starting the next section.

### 6.5 Final Verification

Before marking the Stage 1 batch complete, run the strongest available verification set:

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:cov
```

If a command is unavailable because the repo is not fully scaffolded yet, Codex must report the missing script and the closest verification command that was run instead. Coverage must remain above the `AGENTS.md` threshold once coverage is available.

**Checkpoint E — Final readiness:** Codex reports final test results, changed files, migration status, documentation updates, and whether the work is ready to merge.

### 6.6 Completion Decision

Run `finishing-a-development-branch` after Checkpoint E. Present the founder with the available completion options:

1. Merge to `main`
2. Open a PR
3. Keep the branch for more review
4. Discard the branch

No merge, PR, or discard happens without the founder's explicit decision.

**Checkpoint F — Founder decision:** Codex records the selected completion path and reports the next recommended Stage 1 item from §5.

## 7. Definition of Done

A Stage 1 Superpowers task is complete only when all items below are true:

- The work is one of the approved §5 items.
- The founder approved the spec at Checkpoint B.
- The founder approved the implementation plan at Checkpoint C.
- All protected routes use `JwtAuthGuard`, `TenantGuard`, and `RolesGuard` where applicable.
- Every business query filters by `tenantId`.
- No cross-tenant joins or reads are introduced.
- Every mutating endpoint writes an audit log entry with a matching `AuditAction`.
- Every counted tenant-scoped resource checks `PlanLimit` before creation.
- Backend DTOs use class-validator and do not use `any`.
- Frontend forms use Zod where frontend changes are included.
- Unit, integration, and e2e tests are added or updated for the changed behavior.
- `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm test:cov` pass, or unavailable scripts are explicitly reported.
- Relevant docs are updated in `docs/`.
- The founder chooses the completion path at Checkpoint F.

## 8. Caveats — Confirm Before Founder Approves

1. **TDD enforcement vs. existing scaffolded code**: `test-driven-development` deletes code written before its test. Several Stage 1 modules are already scaffolded with partial test coverage (per the Backend Checkpoint). Recommend applying Superpowers' TDD only to the **new** items in §5, not retroactively to existing scaffolded endpoints — unless the founder explicitly wants a TDD retrofit of Stage 1 as its own task.
2. **`using-git-worktrees` branch strategy**: confirm this is compatible with the Coolify deploy setup — does Coolify deploy only from `main`, or does it also build preview branches? If preview-only-on-main, worktree branches need a defined merge path back to `main` before `finishing-a-development-branch` runs.
3. **Docs location**: Superpowers defaults may not match the repo's `docs/prd`, `docs/architecture`, `docs/database`, `docs/api`, `docs/security` layout from `AGENTS.md`. Codex must save brainstorming/plan outputs into the matching existing folder, not a new Superpowers-specific path.
4. **No bypassing founder sign-off**: the `writing-plans` → approval checkpoint is the only place founder review happens before code is written. Superpowers must not auto-proceed from plan to `subagent-driven-development` without that explicit approval each time.

## 9. Suggested Codex Session Prompt

```
Read AGENTS.md first (including the Quality & Compliance Rules and this
Superpowers Integration addendum).
Confirm the Superpowers plugin is installed and active (/plugins → superpowers).
Current stage: 1 (remaining checkpoint items)
Task: Use brainstorming + writing-plans to produce an implementation plan
  covering:
  (a) email provider integration for invitation/reset emails,
  (b) Redis-backed refresh token session cache,
  (c) TOTP verification,
  (d) Billing Lite per omnichat-master-plan-addendum-v2.md sections 2-4,
  (e) frontend design tokens per omnichat-master-plan-addendum-v2.md section 10.
Present the plan in sections under docs/ (matching existing folders) for my
  review. Do not begin subagent-driven-development on any section until I
  approve it.
Reference files: AGENTS.md, stage-0.md, permission-matrix.md,
  omnichat-master-plan-addendum-v2.md, prisma/schema.prisma
```

---

_End of Superpowers Integration Addendum — merge the Quality & Compliance Rules block (§4) into AGENTS.md after founder review of §8 caveats._
