# Phase A — Knowledge Lite Design

Date: 2026-06-21  
Stage: 5 (Knowledge System Lite)  
Status: Implemented

## Goal

Give tenants a place to store business knowledge (FAQ, policies, product info) and inject the most relevant articles into AI suggested replies — Zaapi-style "Brain" MVP without vector RAG yet.

## Scope (In)

- `KnowledgeArticle` model (tenant-scoped, optional LINE channel scope)
- CRUD API: `GET/POST/PATCH/DELETE /api/v1/knowledge/articles`
- Keyword ranking search (title, content, keywords array)
- Inject `{{knowledge_context}}` into `aiSuggest` and `aiTest` prompts
- Settings UI tab: **Knowledge**
- Audit actions: `KNOWLEDGE_ARTICLE_CREATED`, `UPDATED`, `DELETED`

## Scope (Out — later phases)

- Vector embeddings / semantic RAG (Phase D)
- Scenario engine (Phase B)
- Workflow automation (Phase C)
- AI learning from admin edits (Phase G)

## Data Model

```prisma
model KnowledgeArticle {
  id            String
  tenantId      String
  lineChannelId String?   // null = all channels
  title         String
  content       String
  keywords      String[]
  category      String?
  isActive      Boolean
  createdAt     DateTime
  updatedAt     DateTime
  deletedAt     DateTime?
}
```

## Retrieval Flow

1. Collect query text from last inbound messages + current draft (or sample message in test mode)
2. Load active articles for tenant (+ channel scope: global + channel-specific)
3. Tokenize query, score articles by keyword/title/content match
4. Take top 5, format as numbered context block
5. Replace `{{knowledge_context}}` in prompt (append if custom template omits placeholder)

## RBAC

| Action | OWNER | ADMIN | AGENT | QC | VIEWER |
|--------|-------|-------|-------|-----|--------|
| View   | ✅    | ✅    | ✅    | ✅  | ✅     |
| Create | ✅    | ✅    | ✅    | ❌  | ❌     |
| Edit   | ✅    | ✅    | ✅    | ❌  | ❌     |
| Delete | ✅    | ✅    | ❌    | ❌  | ❌     |

## API

```
GET    /api/v1/knowledge/articles?lineChannelId=&search=&limit=
GET    /api/v1/knowledge/articles/:id
POST   /api/v1/knowledge/articles
PATCH  /api/v1/knowledge/articles/:id
DELETE /api/v1/knowledge/articles/:id  (soft delete)
```

## Frontend

Settings → **Knowledge** tab (`knowledge-manager.tsx`):
- List/search articles
- Create/edit form (title, content, keywords, category, channel scope, active toggle)
- Delete for OWNER/ADMIN only

AI Settings placeholder docs updated with `{{knowledge_context}}`.

## Testing

- `knowledge-search.util.spec.ts` — tokenize, score, rank, format
- `knowledge.service.spec.ts` — CRUD audit, RBAC delete, context build
- `inbox.service.spec.ts` — mock `KnowledgeService` in constructor

## Recommendations

1. **Seed 2-3 sample articles** per tenant during onboarding — empty KB = AI still works but no extra context
2. **Dogfood**: add real shop FAQ, test AI suggest with customer message about shipping/price
3. **Next**: Phase B Scenario Engine — rules for tone/triggers before full workflow canvas

## Success Criteria

- [x] Admin can CRUD knowledge articles from Settings
- [x] AI suggest includes matched articles in prompt
- [x] Test AI uses same knowledge retrieval
- [x] Tenant isolation on all queries
- [x] Audit log on create/update/delete
