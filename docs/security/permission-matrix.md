# Permission Matrix — OmniChat SaaS

Version: 1.0 | Stage: 0 (Architecture)

> Legend: ✅ Allowed | ❌ Denied | ⚡ Own Only | 👁 Read Only

---

## Tenant & Workspace Management

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| Create Tenant                 | ✅    | ❌    | ❌    | ❌  | ❌     |
| Delete Tenant                 | ✅    | ❌    | ❌    | ❌  | ❌     |
| Edit Tenant Settings          | ✅    | ✅    | ❌    | ❌  | ❌     |
| View Tenant Settings          | ✅    | ✅    | ❌    | ❌  | ❌     |
| Create Workspace              | ✅    | ✅    | ❌    | ❌  | ❌     |
| Delete Workspace              | ✅    | ❌    | ❌    | ❌  | ❌     |

---

## User Management

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| Invite User                   | ✅    | ✅    | ❌    | ❌  | ❌     |
| Remove User from Workspace    | ✅    | ✅    | ❌    | ❌  | ❌     |
| Change User Role              | ✅    | ✅    | ❌    | ❌  | ❌     |
| View All Members              | ✅    | ✅    | ✅    | ✅  | ✅     |
| Edit Own Profile              | ✅    | ✅    | ✅    | ✅  | ✅     |
| Enable/Disable 2FA (self)     | ✅    | ✅    | ✅    | ✅  | ✅     |
| Reset Other User Password     | ✅    | ✅    | ❌    | ❌  | ❌     |

---

## LINE OA Channel (Stage 2)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| Connect LINE OA               | ✅    | ✅    | ❌    | ❌  | ❌     |
| Disconnect LINE OA            | ✅    | ✅    | ❌    | ❌  | ❌     |
| View Channel Settings         | ✅    | ✅    | 👁    | 👁  | ❌     |
| Edit Channel Settings         | ✅    | ✅    | ❌    | ❌  | ❌     |
| View Webhook Logs             | ✅    | ✅    | ❌    | ❌  | ❌     |

---

## Conversations & Inbox (Stage 3)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| View All Conversations        | ✅    | ✅    | ⚡    | 👁  | ❌     |
| View Assigned Conversations   | ✅    | ✅    | ✅    | 👁  | ❌     |
| Reply to Conversation         | ✅    | ✅    | ⚡    | ❌  | ❌     |
| Assign Conversation to Agent  | ✅    | ✅    | ⚡    | ❌  | ❌     |
| Reassign Conversation         | ✅    | ✅    | ❌    | ❌  | ❌     |
| Close Conversation            | ✅    | ✅    | ⚡    | ❌  | ❌     |
| Reopen Conversation           | ✅    | ✅    | ⚡    | ❌  | ❌     |
| Add Tag to Conversation       | ✅    | ✅    | ✅    | ❌  | ❌     |
| Set Priority                  | ✅    | ✅    | ✅    | ❌  | ❌     |
| Add Internal Note             | ✅    | ✅    | ✅    | ✅  | ❌     |
| Delete Message (own)          | ✅    | ✅    | ⚡    | ❌  | ❌     |
| Delete Any Message            | ✅    | ✅    | ❌    | ❌  | ❌     |

> ⚡ Own Only = only conversations assigned to themselves

---

## Customer CRM (Stage 4)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| View Customer Profile         | ✅    | ✅    | ✅    | 👁  | ❌     |
| Edit Customer Profile         | ✅    | ✅    | ✅    | ❌  | ❌     |
| Add Customer Note             | ✅    | ✅    | ✅    | ✅  | ❌     |
| Add Customer Tag              | ✅    | ✅    | ✅    | ❌  | ❌     |
| Merge Customer Profiles       | ✅    | ✅    | ❌    | ❌  | ❌     |
| Export Customer Data          | ✅    | ✅    | ❌    | ❌  | ❌     |

---

## Knowledge Base (Stage 5)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| Create KB Article             | ✅    | ✅    | ✅    | ❌  | ❌     |
| Edit KB Article               | ✅    | ✅    | ⚡    | ❌  | ❌     |
| Delete KB Article             | ✅    | ✅    | ❌    | ❌  | ❌     |
| View KB Articles              | ✅    | ✅    | ✅    | ✅  | ✅     |
| Create Saved Reply            | ✅    | ✅    | ✅    | ❌  | ❌     |
| Use Saved Reply               | ✅    | ✅    | ✅    | ❌  | ❌     |

---

## Reports & Analytics (Stage 6-7)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| View Dashboard                | ✅    | ✅    | ⚡    | 👁  | ✅     |
| View Team Reports             | ✅    | ✅    | ❌    | 👁  | 👁     |
| View Own KPI                  | ✅    | ✅    | ✅    | ❌  | ❌     |
| View All Agent KPIs           | ✅    | ✅    | ❌    | 👁  | ❌     |
| Export Reports                | ✅    | ✅    | ❌    | 👁  | ❌     |

---

## QC Center (Stage 8)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| Review Conversation           | ✅    | ✅    | ❌    | ✅  | ❌     |
| Score Conversation            | ✅    | ✅    | ❌    | ✅  | ❌     |
| Add QC Feedback               | ✅    | ✅    | ❌    | ✅  | ❌     |
| View Own QC Score             | ✅    | ✅    | ✅    | ❌  | ❌     |
| View All QC Scores            | ✅    | ✅    | ❌    | ✅  | ❌     |
| Dispute QC Score              | ✅    | ✅    | ✅    | ❌  | ❌     |

---

## Audit Logs (Stage 9)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| View Audit Logs               | ✅    | ✅    | ❌    | ❌  | ❌     |
| Export Audit Logs             | ✅    | ❌    | ❌    | ❌  | ❌     |
| Delete Audit Logs             | ❌    | ❌    | ❌    | ❌  | ❌     |

> Audit logs are IMMUTABLE. No role can delete them.

---

## Automation (Stage 10)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| Create Automation Rule        | ✅    | ✅    | ❌    | ❌  | ❌     |
| Edit Automation Rule          | ✅    | ✅    | ❌    | ❌  | ❌     |
| Delete Automation Rule        | ✅    | ✅    | ❌    | ❌  | ❌     |
| View Automation Rules         | ✅    | ✅    | 👁    | ❌  | ❌     |
| Toggle Automation On/Off      | ✅    | ✅    | ❌    | ❌  | ❌     |

---

## Billing (Stage 17)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| View Subscription             | ✅    | ✅    | ❌    | ❌  | ❌     |
| Change Plan                   | ✅    | ❌    | ❌    | ❌  | ❌     |
| View Invoices                 | ✅    | ✅    | ❌    | ❌  | ❌     |
| Cancel Subscription           | ✅    | ❌    | ❌    | ❌  | ❌     |
| Update Payment Method         | ✅    | ❌    | ❌    | ❌  | ❌     |

---

## AI Features (Stage 12-16)

| Action                        | OWNER | ADMIN | AGENT | QC  | VIEWER |
|-------------------------------|-------|-------|-------|-----|--------|
| Use AI Reply Suggestion       | ✅    | ✅    | ✅    | ❌  | ❌     |
| Enable/Disable AI Copilot     | ✅    | ✅    | ❌    | ❌  | ❌     |
| Upload RAG Documents          | ✅    | ✅    | ❌    | ❌  | ❌     |
| Configure AI Agent            | ✅    | ✅    | ❌    | ❌  | ❌     |
| View AI QA Scores             | ✅    | ✅    | ⚡    | ✅  | ❌     |

---

## Implementation Notes

```typescript
// NestJS Guard implementation reference

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.role === role || user.role === Role.OWNER);
  }
}

// Usage on controller
@Roles(Role.ADMIN, Role.OWNER)
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

---

_Last updated: 2026 | Part of Stage 0 Architecture docs_
