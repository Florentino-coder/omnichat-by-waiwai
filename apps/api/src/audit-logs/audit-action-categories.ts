import { AuditAction } from "@prisma/client";

export const AUDIT_LOG_CATEGORIES = [
  "auth",
  "conversation",
  "ai",
  "knowledge",
  "automation",
  "line",
  "settings",
  "backup"
] as const;

export type AuditLogCategory = (typeof AUDIT_LOG_CATEGORIES)[number];

const CATEGORY_ACTIONS: Record<AuditLogCategory, AuditAction[]> = {
  auth: [
    AuditAction.LOGIN,
    AuditAction.LOGOUT,
    AuditAction.LOGIN_FAILED,
    AuditAction.PASSWORD_CHANGED,
    AuditAction.TWO_FA_ENABLED,
    AuditAction.TWO_FA_DISABLED,
    AuditAction.TENANT_SWITCHED
  ],
  conversation: [
    AuditAction.CONVERSATION_CUSTOMER_RENAMED,
    AuditAction.CONVERSATION_STATUS_CHANGED,
    AuditAction.CONVERSATION_ASSIGNED,
    AuditAction.CONVERSATION_UNASSIGNED,
    AuditAction.CONVERSATION_PRIORITY_CHANGED,
    AuditAction.CONVERSATION_TAG_CREATED,
    AuditAction.CONVERSATION_TAG_UPDATED,
    AuditAction.CONVERSATION_TAG_DELETED,
    AuditAction.CONVERSATION_TAG_ADDED,
    AuditAction.CONVERSATION_TAG_REMOVED,
    AuditAction.CONVERSATION_NOTE_CREATED,
    AuditAction.CONVERSATION_NOTE_DELETED,
    AuditAction.SAVED_REPLY_CREATED,
    AuditAction.SAVED_REPLY_UPDATED,
    AuditAction.SAVED_REPLY_DELETED
  ],
  ai: [
    AuditAction.AI_SUGGEST_GENERATED,
    AuditAction.AI_SUGGEST_SENT,
    AuditAction.AI_SUGGEST_EDITED,
    AuditAction.AI_SUGGEST_REJECTED,
    AuditAction.AI_SUGGEST_FAILED,
    AuditAction.AI_CONVERSATION_SUMMARIZED,
    AuditAction.AI_SCENARIO_CREATED,
    AuditAction.AI_SCENARIO_UPDATED,
    AuditAction.AI_SCENARIO_DELETED,
    AuditAction.AI_SCENARIO_MATCHED,
    AuditAction.AI_AUTO_REPLY_SENT,
    AuditAction.AI_AUTO_REPLY_SKIPPED,
    AuditAction.AI_AUTO_REPLY_ESCALATED,
    AuditAction.AI_AUTO_REPLY_FAILED,
    AuditAction.AUTOMATION_AI_REPLY_SENT,
    AuditAction.AI_POLICY_BLOCKED,
    AuditAction.AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL
  ],
  knowledge: [
    AuditAction.KNOWLEDGE_ARTICLE_CREATED,
    AuditAction.KNOWLEDGE_ARTICLE_UPDATED,
    AuditAction.KNOWLEDGE_ARTICLE_DELETED,
    AuditAction.KNOWLEDGE_DOCUMENT_CREATED,
    AuditAction.KNOWLEDGE_DOCUMENT_DELETED,
    AuditAction.KNOWLEDGE_DOCUMENT_INGESTED,
    AuditAction.KNOWLEDGE_DOCUMENT_INGEST_FAILED,
    AuditAction.KNOWLEDGE_DOCUMENT_REINDEX_REQUESTED
  ],
  automation: [
    AuditAction.AUTOMATION_RULE_CREATED,
    AuditAction.AUTOMATION_RULE_UPDATED,
    AuditAction.AUTOMATION_RULE_DELETED,
    AuditAction.AUTOMATION_RUN_STARTED,
    AuditAction.AUTOMATION_STEP_EXECUTED,
    AuditAction.AUTOMATION_RUN_COMPLETED,
    AuditAction.AUTOMATION_RUN_FAILED
  ],
  line: [
    AuditAction.LINE_CHANNEL_CONNECTED,
    AuditAction.LINE_CHANNEL_UPDATED,
    AuditAction.LINE_CHANNEL_DISCONNECTED,
    AuditAction.LINE_MESSAGE_RECEIVED,
    AuditAction.LINE_REPLY_SENT,
    AuditAction.LINE_WEBHOOK_FAILED,
    AuditAction.LINE_MARK_AS_READ,
    AuditAction.LINE_BROADCAST_SENT,
    AuditAction.LINE_MULTICAST_SENT,
    AuditAction.LINE_FOLLOW_RECEIVED,
    AuditAction.LINE_UNFOLLOW_RECEIVED,
    AuditAction.LINE_UNSEND_RECEIVED,
    AuditAction.LINE_BROADCAST_SCHEDULED,
    AuditAction.LINE_BROADCAST_CANCELLED,
    AuditAction.LINE_BROADCAST_DELETED
  ],
  settings: [
    AuditAction.USER_INVITED,
    AuditAction.USER_REMOVED,
    AuditAction.USER_ROLE_CHANGED,
    AuditAction.TENANT_CREATED,
    AuditAction.TENANT_SETTINGS_CHANGED,
    AuditAction.PLAN_CHANGED,
    AuditAction.PLAN_LIMIT_EXCEEDED,
    AuditAction.USAGE_THRESHOLD_REACHED,
    AuditAction.WORKSPACE_CREATED,
    AuditAction.WORKSPACE_UPDATED,
    AuditAction.WORKSPACE_DELETED,
    AuditAction.INBOX_SETTINGS_UPDATED
  ],
  backup: [
    AuditAction.BACKUP_RUN_TRIGGERED,
    AuditAction.BACKUP_RUN_SUCCEEDED,
    AuditAction.BACKUP_RUN_FAILED
  ]
};

export function isAuditLogCategory(value: string): value is AuditLogCategory {
  return (AUDIT_LOG_CATEGORIES as readonly string[]).includes(value);
}

export function actionsForCategory(category: AuditLogCategory): AuditAction[] {
  return CATEGORY_ACTIONS[category];
}
