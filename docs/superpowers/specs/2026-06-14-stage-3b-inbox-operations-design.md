# Stage 3B - Inbox Operations Design

## สถานะ

วันที่: 2026-06-14

ภาษา: ไทยเป็นค่าเริ่มต้น, รองรับอังกฤษเป็นตัวเลือก

สถานะ: รอ founder review ก่อนเริ่ม implement

## เป้าหมาย

ทำ Unified Inbox ให้พร้อมใช้งานจริงมากขึ้นแบบ Zaapi core operations โดยยังอยู่ใน Stage 3 และไม่กระโดดไป AI, automation, reporting, search, หรือ multi-channel ก่อนเวลา

Stage นี้ทำให้ทีมตอบแชทใช้ workflow หลักได้:

- เห็นว่าแชทไหนใครรับผิดชอบ
- ติด label/tag ได้
- กำหนด priority ได้
- เขียน internal note ได้
- ใช้ quick reply พื้นฐานได้
- สลับภาษา UI ไทย/อังกฤษได้
- ใช้ font ไทยที่อ่านง่าย: Noto Sans Thai

## Zaapi Gap ที่นำมาใช้

จากการเทียบกับ Zaapi ฟังก์ชันที่ควรมีใน main product ก่อนลูกเล่นใหญ่:

- Unified inbox: มีแล้วระดับพื้นฐาน
- Assignment: ยังไม่มี
- Tags/labels: ยังไม่มี
- Priority: ยังไม่มี
- Internal notes: ยังไม่มี
- Quick replies: ยังไม่มี
- Analytics/KPI: ยังไม่ทำใน Stage นี้
- Automations: ยังไม่ทำใน Stage นี้
- AI agent: ยังไม่ทำใน Stage นี้
- Broadcast: ยังไม่ทำใน Stage นี้
- Multi-channel: ยังไม่ทำใน Stage นี้

## Scope

### 1. Conversation Assignment

เพิ่ม agent owner ให้ conversation:

- assigned member เป็น `WorkspaceMember`
- ADMIN และ AGENT assign/reassign ได้
- QC อ่านได้ แต่แก้ไม่ได้
- audit action ทุกครั้งที่ assign/reassign/unassign
- list inbox filter ได้: `mine`, `unassigned`, `all`

### 2. Tags / Labels

เพิ่ม tag ต่อ tenant:

- tag มีชื่อ สี และ soft delete
- conversation ผูกได้หลาย tag
- ADMIN และ AGENT เพิ่ม/ลบ tag จาก conversation ได้
- ADMIN จัดการ tag master ได้
- list inbox filter ตาม tag ได้
- audit action เมื่อเพิ่ม/ลบ tag จาก conversation

### 3. Priority

เพิ่ม priority บน conversation:

- enum: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- default: `NORMAL`
- filter/sort ใน inbox ได้
- audit action เมื่อเปลี่ยน priority

### 4. Internal Notes

เพิ่ม note ภายใน conversation:

- note ไม่ส่งออก LINE
- ADMIN/AGENT สร้าง note ได้
- QC อ่าน note ได้
- soft delete note ได้เฉพาะผู้เขียนหรือ ADMIN
- audit action เมื่อสร้าง/ลบ note

### 5. Saved / Quick Reply Lite

เพิ่ม quick reply แบบ Stage 5 Lite แต่จำกัดเฉพาะ inbox:

- ADMIN จัดการ saved replies ได้
- AGENT ใช้ saved replies ได้
- content เป็น text เท่านั้น
- มี shortcut search ใน reply composer
- ยังไม่ทำ knowledge base, folder, AI suggestion, approval workflow

### 6. Thai / English UI Foundation

เพิ่มระบบแปลภาษาแบบเล็กพอ:

- default locale จาก `TenantSettings.defaultLanguage`
- user เลือกได้ `th` หรือ `en` ใน settings หรือ local preference
- แยก dictionary สำหรับ inbox/settings/app shell
- แก้ข้อความไทยเพี้ยนใน inbox ให้เป็น UTF-8 ถูกต้อง
- ไม่เพิ่ม library i18n ถ้ายังไม่จำเป็น

### 7. Font

ใช้ font:

- Thai: `Noto Sans Thai`
- English: แนะนำ `Inter`

เหตุผล:

- Noto Sans Thai อ่านง่ายใน dashboard และข้อความยาว
- Inter ดีสำหรับ SaaS UI, ตัวเลข, table, controls
- Next font load ผ่าน `next/font/google`
- ตั้ง CSS variable ให้ typography ใช้ทั้งเว็บ

## Out Of Scope

- Facebook, Instagram, TikTok, Shopee, Lazada, email, web chat
- AI copilot, AI agent, RAG
- automation flow builder
- reporting dashboard
- OpenSearch/global search
- full CRM profile merge
- billing full
- file upload/storage สำหรับ paste image

## Data Model

เพิ่ม/แก้ Prisma:

- `Conversation.assignedToMemberId String?`
- `Conversation.priority ConversationPriority @default(NORMAL)`
- `ConversationTag`
- `ConversationTagLink`
- `ConversationInternalNote`
- `SavedReply`
- `AuditAction` values สำหรับ assignment, tags, priority, notes, saved replies

ทุก business table ต้องมี:

- `tenantId`
- `createdAt`
- `updatedAt`
- `deletedAt` ถ้าเป็น soft-deletable
- indexes ตาม tenant/query path

## API

เพิ่ม endpoint ใต้ `/api/v1/inbox`:

- `PATCH /conversations/:id/assignment`
- `PATCH /conversations/:id/priority`
- `GET /tags`
- `POST /tags`
- `PATCH /tags/:id`
- `DELETE /tags/:id`
- `POST /conversations/:id/tags`
- `DELETE /conversations/:id/tags/:tagId`
- `GET /conversations/:id/notes`
- `POST /conversations/:id/notes`
- `DELETE /conversations/:id/notes/:noteId`
- `GET /saved-replies`
- `POST /saved-replies`
- `PATCH /saved-replies/:id`
- `DELETE /saved-replies/:id`

Response ใช้ envelope pattern ตาม AGENTS.md ถ้า module ปัจจุบันยังไม่ใช้ envelope ให้ทำเป็น checkpoint migration เฉพาะ inbox หรือระบุ tech debt ชัดเจนก่อนขยายทั้งระบบ

## UI

ปรับ inbox เป็น 3-pane เดิม แต่เพิ่ม controls:

- left pane: filter `All`, `Mine`, `Unassigned`, priority, tag
- conversation row: assignee chip, tag chips, priority marker
- thread header: assign dropdown, priority dropdown, status
- right pane: customer context + tags + internal notes
- composer: quick reply picker/search
- settings: language switch + font applied globally

ต้องไม่ทำ marketing page. หน้าแรกยังเป็น app workflow.

## RBAC

- OWNER/ADMIN: จัดการ tags, saved replies, assignment, priority, notes
- AGENT: assign/reassign conversation, set priority, add/remove existing tags, write notes, use saved replies
- QC: read-only conversation/tags/notes
- VIEWER: ไม่มี inbox write access

ถ้าเปลี่ยน permission ต้อง update `/docs/security/permission-matrix.md`

## Audit

Mutating endpoint ทุกตัวต้องเขียน audit log ใน task เดียวกัน:

- `CONVERSATION_ASSIGNED`
- `CONVERSATION_UNASSIGNED`
- `CONVERSATION_PRIORITY_CHANGED`
- `CONVERSATION_TAG_ADDED`
- `CONVERSATION_TAG_REMOVED`
- `CONVERSATION_NOTE_CREATED`
- `CONVERSATION_NOTE_DELETED`
- `SAVED_REPLY_CREATED`
- `SAVED_REPLY_UPDATED`
- `SAVED_REPLY_DELETED`

## Testing

ต้องมี:

- service unit tests สำหรับ tenant isolation และ RBAC-sensitive behavior
- controller/integration tests สำหรับ endpoint สำคัญ
- web tests สำหรับ inbox render/filter/actions
- Prisma validate
- lint/typecheck/build

ห้าม run DB destructive tests กับ Supabase/Coolify/non-disposable database.

## Checkpoints

### Checkpoint L: Schema + API Operations

เพิ่ม schema, migration, DTO, service, controller, tests สำหรับ assignment, priority, tags, notes.

### Checkpoint M: Inbox UI Operations

เพิ่ม UI controls, filters, right-pane notes/tags, assignment/priority actions.

### Checkpoint N: Saved Reply Lite

เพิ่ม saved reply API/UI และ composer insert flow.

### Checkpoint O: Thai/i18n/font

แก้ภาษาไทยเพี้ยน, เพิ่ม dictionary ไทย/อังกฤษ, เพิ่ม Noto Sans Thai + Inter.

### Checkpoint P: Docs + Verification

อัปเดต PRD Stage 3, permission matrix, API docs ถ้ามี, run verification.

## Open Decision

แนะนำทำตามลำดับนี้:

1. Checkpoint O ก่อน ถ้า UI ไทยเพี้ยนจริงใน browser
2. Checkpoint L
3. Checkpoint M
4. Checkpoint N
5. Checkpoint P

เหตุผล: ภาษาเพี้ยนทำให้ review ยาก ถ้าแก้ก่อน งาน UI ต่อจากนั้นนิ่งกว่า.

