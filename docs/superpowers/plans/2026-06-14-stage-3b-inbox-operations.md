# Stage 3B Inbox Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Zaapi-like inbox operations for OmniChat Stage 3: assignment, tags, priority, internal notes, saved replies lite, Thai/English UI foundation, and Noto Sans Thai font.

**Architecture:** Extend current tenant-scoped Inbox module instead of creating a new product area. Keep data ownership in Prisma, business rules in NestJS services, and UI state in the existing Inbox page until splitting becomes necessary. Every mutating endpoint writes audit log in the same service method.

**Tech Stack:** NestJS 10, Prisma 5, Next.js 15, React 19, TailwindCSS, Jest, `next/font/google`.

---

## File Map

- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\prisma\schema.prisma`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\prisma\migrations\<timestamp>_stage_3b_inbox_operations\migration.sql`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\inbox.controller.ts`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\inbox.service.ts`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\dto\assign-conversation.dto.ts`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\dto\update-conversation-priority.dto.ts`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\dto\create-conversation-tag.dto.ts`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\dto\update-conversation-tag.dto.ts`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\dto\create-internal-note.dto.ts`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\dto\create-saved-reply.dto.ts`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\dto\update-saved-reply.dto.ts`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\api\src\inbox\inbox.service.spec.ts`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\web\app\app\inbox\page.tsx`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\web\app\app\layout.tsx`
- Create: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\web\app\lib\i18n.ts`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\apps\web\__tests__\inbox-page.test.tsx`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\docs\prd\stage-3-unified-inbox.md`
- Modify: `C:\Users\fluk3\Documents\all-chat-line-oa\docs\security\permission-matrix.md`

## Task 1: Encoding, Font, i18n Foundation

- [ ] **Step 1: Write failing web test for Thai text**

Add assertions in `apps\web\__tests__\inbox-page.test.tsx` that expect readable Thai text:

```tsx
expect(await screen.findByText("กล่องข้อความ")).toBeInTheDocument();
expect(screen.getByText("ตอบครบทุกแชทแล้ว")).toBeInTheDocument();
```

- [ ] **Step 2: Run test**

Run:

```powershell
npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand
```

Expected: FAIL until UI text is corrected.

- [ ] **Step 3: Add dictionary**

Create `apps\web\app\lib\i18n.ts`:

```ts
export type Locale = "th" | "en";

export const defaultLocale: Locale = "th";

export const messages = {
  th: {
    inboxTitle: "กล่องข้อความ",
    inboxSubtitle: "แชท LINE ที่ซิงก์จาก webhook ที่ยืนยันแล้ว",
    allReplied: "ตอบครบทุกแชทแล้ว",
    conversations: "แชท",
    messageThread: "ข้อความ",
    customerContext: "ข้อมูลลูกค้า",
    save: "บันทึก",
    loading: "กำลังโหลด..."
  },
  en: {
    inboxTitle: "Inbox",
    inboxSubtitle: "LINE conversations synced from verified webhooks.",
    allReplied: "All conversations replied",
    conversations: "Conversations",
    messageThread: "Message thread",
    customerContext: "Customer context",
    save: "Save",
    loading: "Loading..."
  }
} as const;

export function getMessages(locale: Locale = defaultLocale) {
  return messages[locale] ?? messages.th;
}
```

- [ ] **Step 4: Apply font**

Modify `apps\web\app\app\layout.tsx` to load fonts:

```tsx
import { Inter, Noto_Sans_Thai } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai"
});
```

Set body class to include both variables and use CSS font stack:

```tsx
<body className={`${inter.variable} ${notoSansThai.variable} font-sans`}>
```

- [ ] **Step 5: Replace mojibake strings in inbox**

Use dictionary values in `apps\web\app\app\inbox\page.tsx`:

```tsx
const t = getMessages("th");
```

Replace visible broken Thai strings with `t.*` or correct Thai literals.

- [ ] **Step 6: Verify**

Run:

```powershell
npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand
npm run lint
```

Expected: PASS.

## Task 2: Prisma Schema for Inbox Operations

- [ ] **Step 1: Add failing Prisma validation target**

Run before editing:

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/omnichat'; $env:DIRECT_URL='postgresql://user:pass@localhost:5432/omnichat'; npx prisma validate
```

Expected: PASS current schema.

- [ ] **Step 2: Update schema**

Modify `prisma\schema.prisma`:

```prisma
enum ConversationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}
```

Add audit actions:

```prisma
CONVERSATION_ASSIGNED
CONVERSATION_UNASSIGNED
CONVERSATION_PRIORITY_CHANGED
CONVERSATION_TAG_CREATED
CONVERSATION_TAG_UPDATED
CONVERSATION_TAG_DELETED
CONVERSATION_TAG_ADDED
CONVERSATION_TAG_REMOVED
CONVERSATION_NOTE_CREATED
CONVERSATION_NOTE_DELETED
SAVED_REPLY_CREATED
SAVED_REPLY_UPDATED
SAVED_REPLY_DELETED
```

Add fields to `Conversation`:

```prisma
assignedToMemberId String?
assignedToMember   WorkspaceMember? @relation("AssignedConversations", fields: [assignedToMemberId], references: [id])
priority           ConversationPriority @default(NORMAL)
tagLinks           ConversationTagLink[]
internalNotes      ConversationInternalNote[]
```

Add relation to `WorkspaceMember`:

```prisma
assignedConversations Conversation[] @relation("AssignedConversations")
internalNotes ConversationInternalNote[]
```

Add models:

```prisma
model ConversationTag {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  name      String
  color     String   @default("#64748b")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  conversations ConversationTagLink[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("conversation_tags")
}

model ConversationTagLink {
  id             String          @id @default(uuid())
  tenantId       String
  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  conversationId String
  conversation   Conversation    @relation(fields: [conversationId], references: [id])
  tagId          String
  tag            ConversationTag @relation(fields: [tagId], references: [id])
  createdAt      DateTime        @default(now())

  @@unique([conversationId, tagId])
  @@index([tenantId])
  @@index([tagId])
  @@map("conversation_tag_links")
}

model ConversationInternalNote {
  id             String          @id @default(uuid())
  tenantId       String
  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  conversationId String
  conversation   Conversation    @relation(fields: [conversationId], references: [id])
  authorMemberId String
  authorMember   WorkspaceMember @relation(fields: [authorMemberId], references: [id])
  body           String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  deletedAt      DateTime?

  @@index([tenantId])
  @@index([conversationId])
  @@map("conversation_internal_notes")
}

model SavedReply {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  title     String
  body      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([tenantId])
  @@map("saved_replies")
}
```

- [ ] **Step 3: Generate migration**

Run against local/disposable DB only:

```powershell
npx prisma migrate dev --name stage_3b_inbox_operations
```

- [ ] **Step 4: Validate**

Run:

```powershell
npx prisma validate
npx prisma generate
```

Expected: PASS.

## Task 3: Backend API and Tests

- [ ] **Step 1: Write service tests**

Add tests in `apps\api\src\inbox\inbox.service.spec.ts` for:

```ts
it("assigns a tenant conversation to a member in the same tenant", async () => {});
it("rejects assignment to a member from another tenant", async () => {});
it("updates priority and writes an audit log", async () => {});
it("adds and removes tenant tags from a conversation", async () => {});
it("creates an internal note without creating a LINE message", async () => {});
it("lists saved replies for the current tenant only", async () => {});
```

- [ ] **Step 2: Run focused tests**

```powershell
npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts --runInBand
```

Expected: FAIL before implementation.

- [ ] **Step 3: Add DTOs**

DTOs must use class-validator:

```ts
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateConversationPriorityDto {
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority!: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}
```

Use same pattern for assignment, tags, notes, saved replies. No `any`.

- [ ] **Step 4: Implement service methods**

Add tenant-filtered methods in `InboxService`:

```ts
assignConversation(tenantId: string, userId: string, conversationId: string, memberId: string | null)
updatePriority(tenantId: string, userId: string, conversationId: string, priority: ConversationPriority)
listTags(tenantId: string)
createTag(tenantId: string, userId: string, input: { name: string; color?: string })
addConversationTag(tenantId: string, userId: string, conversationId: string, tagId: string)
removeConversationTag(tenantId: string, userId: string, conversationId: string, tagId: string)
listNotes(tenantId: string, conversationId: string)
createNote(tenantId: string, userId: string, conversationId: string, body: string)
deleteNote(tenantId: string, userId: string, conversationId: string, noteId: string)
listSavedReplies(tenantId: string)
createSavedReply(tenantId: string, userId: string, input: { title: string; body: string })
updateSavedReply(tenantId: string, userId: string, id: string, input: { title?: string; body?: string; isActive?: boolean })
deleteSavedReply(tenantId: string, userId: string, id: string)
```

- [ ] **Step 5: Add controller routes**

Add routes listed in spec under `/api/v1/inbox`. Use guards already on `InboxController`.

- [ ] **Step 6: Verify**

```powershell
npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts --runInBand
npm run lint
npm run api:build
```

Expected: PASS.

## Task 4: Inbox UI Operations

- [ ] **Step 1: Write failing UI tests**

Add expectations:

```tsx
expect(screen.getByRole("button", { name: /assign/i })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /priority/i })).toBeInTheDocument();
expect(screen.getByText("แท็ก")).toBeInTheDocument();
expect(screen.getByText("โน้ตภายใน")).toBeInTheDocument();
```

- [ ] **Step 2: Run test**

```powershell
npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Add UI controls**

Modify inbox page:

- load tags and saved replies with `apiFetch`
- add filter state: `assignmentFilter`, `priorityFilter`, `tagFilter`
- render assignee chip, priority chip, tag chips
- render internal note form in right pane
- insert saved reply body into composer draft

- [ ] **Step 4: Verify**

```powershell
npm run web:test -- apps/web/__tests__/inbox-page.test.tsx --runInBand
npm run web:test -- --runInBand
npm run lint
npm run web:build
```

Expected: PASS.

## Task 5: Docs and Checkpoint

- [ ] **Step 1: Update Stage 3 PRD**

Modify `docs\prd\stage-3-unified-inbox.md`:

```md
- [x] Checkpoint L: Inbox assignment, priority, tags, and internal notes.
- [x] Checkpoint M: Inbox UI operations.
- [x] Checkpoint N: Saved reply lite.
- [x] Checkpoint O: Thai/English UI foundation and Noto Sans Thai font.
```

- [ ] **Step 2: Update permission matrix**

Add rows for:

- conversation assignment
- priority
- tags
- internal notes
- saved replies
- language setting

- [ ] **Step 3: Final verification**

Run:

```powershell
npm run lint
npm run web:test -- --runInBand
npm run api:test -- apps/api/src/inbox/inbox.service.spec.ts --runInBand
npm run api:build
npm run web:build
```

Expected: all PASS. If DB-backed tests need DATABASE_URL, run only against disposable local DB.

- [ ] **Step 4: Commit checkpoint**

```powershell
git add prisma/schema.prisma prisma/migrations apps/api/src/inbox apps/web/app/app/inbox apps/web/app/lib apps/web/__tests__/inbox-page.test.tsx docs/prd/stage-3-unified-inbox.md docs/security/permission-matrix.md
git commit -m "feat: add stage 3b inbox operations"
```
