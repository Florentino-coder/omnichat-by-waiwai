# OmniChat SaaS — Infrastructure & Performance Blueprint
> สรุปแผนโครงสร้างระบบ + แนวทางทำให้เว็บโหลดเร็ว ไม่แลค ระดับมืออาชีพ
> อัปเดต: มิถุนายน 2026

---

## 1. สถานะปัจจุบันและปัญหาที่ต้องแก้

### Stack ที่ใช้งานอยู่
| Layer | Service | Plan | สถานะ |
|---|---|---|---|
| Frontend | Vercel (Next.js 15) | Free/Hobby | ⚠️ ต้อง Upgrade |
| Backend | Render (NestJS 10) | Free | 🚨 Cold Start — อันตรายมาก |
| Database | Supabase (PostgreSQL 16) | Free | ⚠️ Connection จะเต็ม |
| Cache | Upstash (Redis 7) | Free | ⚠️ เกิน Quota ทุกวัน |

### ตัวเลขสเกลจริงที่ระบบต้องรับ
- แชทต่อวัน: **1,000–2,000+ การสนทนา**
- พีคทราฟฟิก: **30–100+ คน/นาที**
- ทีมงาน: **50–100 คน (concurrent)**
- Tenant: **4 บริษัท (ขยายได้ในอนาคต)**

---

## 2. แผนอัปเกรด Infrastructure (ทำทันที)

### 2.1 ลำดับความเร่งด่วน

```
วันนี้ (บล็อก Production):
  [1] Render → Starter ($7/mo)     ← หยุด Cold Start ก่อน LINE Webhook หาย
  [2] Supabase Connection Pooler   ← ฟรี ทำได้เลย ไม่ต้อง Upgrade

สัปดาห์นี้ (ก่อนเปิดทีม):
  [3] Supabase → Pro ($25/mo)      ← Storage + Connection เพิ่ม
  [4] Upstash → Pay-as-you-go      ← ไม่มี Quota ตัด

ก่อน Full Launch:
  [5] Vercel → Pro ($20/mo)        ← ทีมใหญ่ + Timeout นานขึ้น
```

### 2.2 ค่าใช้จ่ายรายเดือน

| Phase | บริการ | ราคา/เดือน |
|---|---|---|
| **เริ่มต้น** | Render Starter + Supabase Pro + Upstash PAYG | ~$35–40 |
| **เต็มระบบ** | + Vercel Pro | ~$55–67 |
| **Scale up** | Render Standard + Supabase Add-on | ~$100–150 |

> สเกลระดับ 2,000 แชท/วัน + ทีม 100 คน ค่าใช้จ่าย $67/เดือน ถือว่าถูกมาก

---

## 3. การตั้งค่า Supabase Connection Pooler (ทำฟรี ทำได้เดี๋ยวนี้)

### 3.1 ขั้นตอน

1. เปิด Supabase Dashboard → กด **Connect**
2. เลือก Tab **"Transaction pooler"** (ไม่ใช่ Direct connection)
3. Copy Connection String (Port **6543**)

### 3.2 อัปเดต `.env` ของ NestJS

```env
# ลบบรรทัดเก่า (port 5432) ออก แล้วใส่แทน:

# Runtime — ใช้ Pooler เสมอ
DATABASE_URL="postgresql://postgres.tnqntvqeorpxazfjmsyk:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Migration เท่านั้น — Direct Connection
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.tnqntvqeorpxazfjmsyk.supabase.co:5432/postgres"
```

### 3.3 อัปเดต `schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 3.4 ทำไมต้องมี 2 URL

| URL | Port | ใช้เมื่อ |
|---|---|---|
| `DATABASE_URL` (Pooler) | 6543 | ทุก Query ที่ App ยิง |
| `DIRECT_URL` (Direct) | 5432 | `prisma migrate deploy` เท่านั้น |

---

## 4. Database Index — สำคัญมากก่อนเปิดจริง

### 4.1 ตรวจสอบ Index ที่มีอยู่

รัน SQL นี้ใน Supabase SQL Editor:

```sql
SELECT
  t.table_name,
  CASE WHEN i.indexname IS NOT NULL
    THEN '✅ มี Index'
    ELSE '❌ ไม่มี — ต้องเพิ่มด่วน'
  END as tenant_index_status
FROM information_schema.tables t
LEFT JOIN pg_indexes i
  ON i.tablename = t.table_name
  AND i.indexdef LIKE '%tenant_id%'
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY tenant_index_status;
```

### 4.2 Index ที่ต้องมีทุกตาราง

```sql
-- ตารางหลักที่ Query บ่อย ต้องมี Composite Index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_tenant_conversation
  ON messages (tenant_id, conversation_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_tenant_status
  ON conversations (tenant_id, status, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_tenant_assignee
  ON conversations (tenant_id, assigned_to, status);

-- Index สำหรับ LINE Webhook lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_accounts_tenant
  ON line_accounts (tenant_id, channel_id);
```

> `CONCURRENTLY` = สร้าง Index โดยไม่ Lock ตาราง ปลอดภัยบน Production

### 4.3 แผนสเกล Database ตามจำนวน Tenant

| จำนวน Tenant | แนวทาง |
|---|---|
| 1–10 | Supabase Pro — ระบบปัจจุบันรองรับได้ |
| 10–50 | + Read Replica + Query Optimization |
| 50–100 | พิจารณา Neon / PlanetScale (ออกแบบมาสำหรับ SaaS) |
| 100+ | Database Sharding ตาม Tenant Cluster |

---

## 5. Performance — ทำให้เว็บเร็วระดับมืออาชีพ

### 5.1 Next.js 15 — Frontend Performance

**ก. เปิด React Server Components ให้เต็มที่**

```tsx
// ❌ แบบเดิม — โหลดทุกอย่างบน Client
'use client'
export default function ConversationList() {
  const [data, setData] = useState([])
  useEffect(() => { fetch('/api/conversations')... }, [])
}

// ✅ แบบใหม่ — โหลดบน Server ก่อน ส่งมา Client เป็น HTML สำเร็จ
// ไม่ต้องรอ JS โหลด ไม่มี Loading Flash
export default async function ConversationList({ tenantId }) {
  const conversations = await getConversations(tenantId) // Server-side
  return <ConversationListClient initialData={conversations} />
}
```

**ข. Streaming UI — แสดงผลทันที ไม่รอทั้งหน้า**

```tsx
// app/inbox/page.tsx
import { Suspense } from 'react'

export default function InboxPage() {
  return (
    <div className="flex h-screen">
      {/* แสดง Sidebar ทันที ไม่รอ Chat List */}
      <Sidebar />

      {/* Chat List โหลดแยก — มี Skeleton ระหว่างรอ */}
      <Suspense fallback={<ConversationSkeleton />}>
        <ConversationList />
      </Suspense>

      {/* Chat Window โหลดแยก */}
      <Suspense fallback={<ChatSkeleton />}>
        <ChatWindow />
      </Suspense>
    </div>
  )
}
```

**ค. Image Optimization — รูปสลิปและรูปโปรไฟล์ลูกค้า**

```tsx
import Image from 'next/image'

// ✅ ใช้ next/image เสมอ — auto WebP, lazy load, ไม่ Layout Shift
<Image
  src={profileUrl}
  alt={customerName}
  width={40}
  height={40}
  className="rounded-full"
  // placeholder="blur" // ใส่ถ้ามี blurDataURL
/>
```

### 5.2 NestJS — Backend Performance

**ก. Response Caching ด้วย Redis (Upstash ที่มีอยู่แล้ว)**

```typescript
// ข้อมูลที่ไม่เปลี่ยนบ่อย Cache ไว้เลย
@Injectable()
export class ConversationService {

  async getConversations(tenantId: string, status: string) {
    const cacheKey = `conversations:${tenantId}:${status}`

    // ดึงจาก Cache ก่อน
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // ถ้าไม่มี ดึงจาก DB แล้ว Cache ไว้ 30 วินาที
    const data = await this.prisma.conversation.findMany({
      where: { tenantId, status },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    await this.redis.setex(cacheKey, 30, JSON.stringify(data))
    return data
  }

  // เมื่อมีข้อความใหม่ → ล้าง Cache ของ Tenant นั้น
  async invalidateCache(tenantId: string) {
    const keys = await this.redis.keys(`conversations:${tenantId}:*`)
    if (keys.length) await this.redis.del(...keys)
  }
}
```

**ข. BullMQ Queue — รับ LINE Webhook ไม่ตกแม้พีค 100 คน/นาที**

```typescript
// webhook.controller.ts — รับไว ไม่ Block
@Post('line/webhook')
async handleWebhook(@Body() body: LineWebhookDto) {
  // ✅ โยนเข้า Queue ทันที ตอบ LINE กลับก่อน (LINE Timeout 10 วิ)
  await this.webhookQueue.add('process-line-event', body, {
    attempts: 3,           // Retry 3 ครั้งถ้าพัง
    backoff: { type: 'exponential', delay: 1000 },
  })
  return { status: 'ok' }  // ตอบ LINE ใน < 1 วินาที
}

// webhook.processor.ts — ประมวลผลใน Background
@Processor('webhook')
export class WebhookProcessor {
  @Process('process-line-event')
  async processLineEvent(job: Job<LineWebhookDto>) {
    const { events, tenantId } = job.data
    for (const event of events) {
      await this.messageService.saveMessage(event)
      await this.sseService.broadcast(tenantId, event) // ส่ง Real-time
    }
  }
}
```

**ค. Database Query Optimization**

```typescript
// ❌ N+1 Query — ดึง 50 แชท แล้วดึง User ทีละแชท = 51 Queries
const conversations = await prisma.conversation.findMany(...)
for (const conv of conversations) {
  conv.user = await prisma.user.findUnique({ where: { id: conv.userId } })
}

// ✅ 1 Query — ดึงพร้อม Relation ทีเดียว
const conversations = await prisma.conversation.findMany({
  where: { tenantId },
  include: {
    customer: { select: { id: true, displayName: true, pictureUrl: true } },
    assignedTo: { select: { id: true, name: true } },
    _count: { select: { messages: true } },
  },
  orderBy: { updatedAt: 'desc' },
  take: 50,
})
```

### 5.3 Real-time SSE — ไม่ให้กระตุก

```typescript
// sse.service.ts — ใช้ Redis Pub/Sub ข้าม NestJS Instance
@Injectable()
export class SseService {
  private clients = new Map<string, Map<string, Response>>()

  // Agent เชื่อมต่อ SSE
  addClient(tenantId: string, agentId: string, res: Response) {
    if (!this.clients.has(tenantId)) {
      this.clients.set(tenantId, new Map())
    }
    this.clients.get(tenantId).set(agentId, res)

    // Subscribe Redis Channel ของ Tenant นี้
    this.redis.subscribe(`sse:${tenantId}`, (message) => {
      this.sendToClient(res, message)
    })

    // Heartbeat ทุก 30 วิ ป้องกัน Connection หลุด
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 30000)

    res.on('close', () => {
      clearInterval(heartbeat)
      this.clients.get(tenantId)?.delete(agentId)
    })
  }

  // Broadcast ข้อความใหม่ไปทุก Agent ใน Tenant
  async broadcast(tenantId: string, data: unknown) {
    await this.redis.publish(`sse:${tenantId}`, JSON.stringify(data))
  }
}
```

---

## 6. Checklist ก่อน Go Live

### Infrastructure
- [ ] Render Upgrade → Starter (ไม่มี Cold Start)
- [ ] Supabase เปลี่ยนมาใช้ Transaction Pooler (Port 6543)
- [ ] Supabase Upgrade → Pro ($25/mo)
- [ ] Upstash เปลี่ยนเป็น Pay-as-you-go
- [ ] Vercel Upgrade → Pro ($20/mo)

### Database
- [ ] รัน SQL ตรวจสอบ Index บน `tenant_id`
- [ ] เพิ่ม Composite Index บนตารางหลัก (messages, conversations)
- [ ] ทดสอบ Query Performance ด้วย `EXPLAIN ANALYZE`

### Backend
- [ ] ติดตั้ง BullMQ Queue สำหรับ LINE Webhook
- [ ] เพิ่ม Redis Cache สำหรับ Conversation List
- [ ] ตรวจสอบ N+1 Query ทุก Endpoint

### Frontend
- [ ] ใช้ React Server Components สำหรับหน้าหลัก
- [ ] เพิ่ม Suspense + Skeleton ทุกส่วนที่รอ Data
- [ ] เปลี่ยน `<img>` ทั้งหมดเป็น `<Image>` ของ Next.js
- [ ] ทดสอบ Lighthouse Score ให้ได้ > 90

---

## 7. แผนขยายระบบในอนาคต

```
ปัจจุบัน (4 Tenant):
  Vercel → NestJS (Render 1 Instance) → Supabase → Upstash

เมื่อ Tenant เพิ่มขึ้น (10-20 Tenant):
  Vercel → NestJS (Render 2 Instance + Load Balancer)
         → Supabase Pro + Read Replica
         → Upstash (Redis Pub/Sub สำหรับ SSE ข้าม Instance)

เมื่อสเกลใหญ่ (50+ Tenant):
  Cloudflare → NestJS (Multiple Regions)
             → Neon DB (Serverless Postgres, Auto-scale)
             → Upstash (Global Redis)
```

---

## 8. 🎯 สรุปคำแนะนำเชิงกลยุทธ์ — BullMQ ใน Batch 3

### ทำไม BullMQ ถึงเหมาะกับตอนนี้

เนื่องจากมี **Redis (Upstash) เปิดสแตนด์บายรออยู่ในระบบอยู่แล้ว** การติดตั้ง BullMQ เพิ่มเติมจึงทำได้ง่ายมาก แค่เพิ่ม Dependency และเขียน Module ครอบ ไม่ต้องตั้ง Infrastructure ใหม่เลย

```bash
# ติดตั้งแค่นี้ ใช้ Redis เดิมที่มีอยู่ได้เลย
npm install @nestjs/bullmq bullmq
```

### การบรรจุ BullMQ เข้า Batch 3 ทันที

แนะนำให้ติดตั้งและเปิดใช้งาน BullMQ **ควบคู่กับ Batch 3** เพื่อใช้เป็นโครงสร้างพื้นฐานรองรับ 3 งานพร้อมกัน:

```
Batch 3 (Real-time + Media) + BullMQ
│
├── Task 3.1 SSE Real-time
│     └── BullMQ broadcast ข้อความข้าม NestJS Instance → ไม่มีคนตกหล่น
│
├── Task 3.2 Media Upload (Supabase Storage)
│     └── BullMQ รับงานอัปโหลด Background → UI ไม่ค้าง Progress Bar ลื่น
│
└── Task 3.3 Flex Message Parser
      └── BullMQ Queue Parse JSON → ไม่บล็อก Main Thread ตอนข้อมูลหนัก
```

### สถาปัตยกรรมที่ได้หลัง Batch 3 + BullMQ

```
LINE Webhook
    │
    ▼
NestJS Controller  ──► [BullMQ Queue] ──► Worker Process
    │                       │                   │
    │ ตอบ LINE < 1 วิ       │                   ├── บันทึก DB
    │                       │                   ├── อัปโหลด Supabase Storage
    │                       │                   ├── Parse Flex Message
    │                       │                   └── Broadcast ผ่าน Redis Pub/Sub
    │                                                        │
    └──────────────────────────────────────────► SSE → แอดมินทุกคนเห็นพร้อมกัน
```

### เปรียบเทียบก่อน/หลัง

| สถานการณ์ | ก่อน BullMQ | หลัง BullMQ |
|---|---|---|
| ลูกค้า 100 คนทักพร้อมกัน | DB รับไม่ไหว Error | Queue รับหมด ประมวลผลทีละคิว |
| อัปโหลดรูปสลิป | UI ค้างรอ | Background Upload, UI ลื่น |
| NestJS Restart | ข้อความหาย | Queue เก็บไว้ ประมวลผลต่อเมื่อ Restart เสร็จ |
| พีค 100 คน/นาที | Timeout / 500 Error | รับทุก Event ไม่ตก |

### สรุปมติ

> ✅ **บรรจุ BullMQ เข้า Batch 3 ทันที** — ต้นทุนการติดตั้งต่ำมาก (ใช้ Redis เดิม)
> แต่ผลที่ได้คือระบบรองรับ Enterprise Scale ได้ทันที ไม่ต้องมาแก้ Architecture ทีหลัง

---

> สรุป: ลงทุน ~$57/เดือน ตอนนี้ ป้องกันระบบพังตอน Peak
> และทำให้เว็บโหลดเร็วระดับมืออาชีพได้ทันที

---

## 9. 🎨 UX/UI Redesign Spec — Premium Inbox (Desktop + Mobile)

> ใช้ไฟล์นี้เป็น Source of Truth สั่ง Codex implement ทั้ง Desktop และ Mobile

### 9.1 Design Tokens (ห้ามเปลี่ยน)

```css
/* globals.css */
--bg-base: #F7F7FB;
--bg-surface: #FFFFFF;
--primary: #4338CA;
--primary-hover: #372FA3;
--border: #E8E9F0;          /* 0.5px ทุกที่ */

--status-open: #1F9D72;     /* dot + text */
--status-pending: #D97706;  /* dot + text */
--status-closed: #9A9DB0;   /* dot + text */
--status-open-bg: #ECFDF5;
--status-pending-bg: #FFFBEB;

--note-bg: #FFFBEB;         /* Internal note bubble */
--note-border: #FCD34D;
--note-text: #78350F;

--font-heading: 'Plus Jakarta Sans', sans-serif;  /* weight 500 only */
--font-body: 'Inter', sans-serif;                 /* weight 400, 500 */
--font-mono: 'JetBrains Mono', monospace;
/* ห้ามใช้ font-weight 700 ทั้งแอป */
```

### 9.2 Layout Desktop — 3 Panel

```
┌─────────────┬──────────────────────┬─────────────┐
│ LEFT 208px  │   CENTER flex-1      │ RIGHT 190px │
│ Conv List   │   Chat Window        │ Customer    │
│ + Search    │   + Bubbles          │ Info Panel  │
│ + Filters   │   + Input Toolbar    │ + QR List   │
└─────────────┴──────────────────────┴─────────────┘
height: 100vh, overflow: hidden, background: #F7F7FB
```

**ไฟล์ที่ต้องแก้:**
- `apps/web/app/(inbox)/layout.tsx` — 3-panel flex wrapper
- `apps/web/components/inbox/ConversationList.tsx`
- `apps/web/components/inbox/ChatWindow.tsx`
- `apps/web/components/inbox/CustomerPanel.tsx`

### 9.3 Conversation List (LEFT panel)

```
Header: "กล่องข้อความ" font-size 13px weight 500 + icon search + filter
Search: bg #F7F7FB, border 0.5px, radius 8px, placeholder "ค้นหาแชท..."
Filter pills: ทั้งหมด|เปิด · N|รอ · N|ปิดแล้ว — active pill bg #4338CA color white
```

**ConversationCard component props:**
```ts
interface ConversationCardProps {
  id: string
  customerName: string
  customerInitial: string
  preview: string
  time: string
  channelTag: string        // "JB-SV" | "ตลาด" | "Jinbao356"
  status: 'OPEN' | 'PENDING' | 'RESOLVED'
  unreadCount?: number
  isActive?: boolean
}
```

**Card anatomy:**
```
Avatar (30px circle) + right content block
  └── row: name (12px 500) + time (10px muted)
  └── preview text (11px muted, truncate 1 line)
  └── row: channelTag pill + status dot + label

Avatar bg/border สีตาม status:
  OPEN    → bg #ECFDF5  border #6EE7B7  text #065F46  + green online dot
  PENDING → bg #FFFBEB  border #FCD34D  text #92400E  + amber dot + unread badge
  RESOLVED→ bg --bg-base border --border text muted   (ไม่มี dot)

Active card: bg #EEF2FF, border-left 2.5px solid #4338CA, border-radius 0
Channel tag pill: bg #E0E7FF color #3730A3, font-size 10px, radius 4px
Unread badge: 18px circle bg #D97706 color white, font-size 10px
```

### 9.4 Chat Window (CENTER panel)

**Header:**
```
← (ถ้า mobile) | Avatar 32px | Name 13px 500 | Status pill | LINE OA label
ปุ่มขวา: [Normal] [Quick reply] [✓ ดำเนินการแล้ว]
  - ดำเนินการแล้ว: border #1F9D72 bg #ECFDF5 color #065F46
```

**Message Bubbles:**
```
Outbound (admin): justify-content flex-end
  → bg #4338CA color white
  → border-radius: 14px 14px 3px 14px
  → max-width 70%, padding 9px 13px, font-size 12px

Inbound (customer): justify-content flex-start + avatar 24px
  → bg white border 0.5px --border
  → border-radius: 3px 14px 14px 14px
  → avatar: initial circle bg #EEF2FF border #C7D2FE

Internal Note: justify-content flex-start + avatar (team member initial)
  → bg #FFFBEB border #FCD34D color #78350F
  → prefix: <i ti-lock> icon
  → label ล่าง: "โน้ตทีม · HH:MM"

Date separator: horizontal line + centered text "15 มิ.ย. · เริ่มแชท"
System message: centered pill bg --bg-base border --border color muted
  ตัวอย่าง: "ปิดแชทแล้ว · 05:49"
```

**Input Area (bottom):**
```
Toolbar row (border-top 0.5px, border-bottom 0.5px):
  [📎 paperclip] [🖼 photo] [⚡ bolt]  ........  [LINE OA: JB-SV label]

Input row:
  [textarea rounded-full bg #F7F7FB flex-1]  [Send button 36px circle bg #4338CA]
  placeholder: "พิมพ์ข้อความตอบกลับ..."
```

### 9.5 Customer Info Panel (RIGHT panel)

```
Section 1 — Customer Profile
  Avatar 36px + Name 12px 500 + LINE OA label with ti-brand-line icon

Section 2 — มอบหมาย
  Dropdown bg #F7F7FB border --border radius 8px + chevron-down icon

Section 3 — แท็ก
  Pill list: bg #E0E7FF color #3730A3 radius 20px
  + เพิ่ม button: dashed border radius 20px

Section 4 — Quick Reply
  Header row: "⚡ Quick Reply" label + Auto toggle pill (bg #EEF2FF)
  Toggle ON: bg #4338CA with white knob right-aligned
  Each QR card: bg #F7F7FB border --border radius 8px padding 8px 10px
    title: 11px 500 --text-primary
    subtitle: 10px muted
```

---

### 9.6 Mobile Layout — 3 Screens

**หลักการ:** Single column, full-screen per view, Bottom Navigation 4 tabs

```
Screen 1: Conversation List
Screen 2: Chat Window (tap card → push screen)
Screen 3: Customer Info (tap ti-user-circle in chat header → slide up)
```

**Bottom Navigation (54px, border-top 0.5px):**
```
[แชท ti-message-circle] [ลูกค้า ti-users] [รายงาน ti-chart-bar] [ตั้งค่า ti-settings]
Active tab: color #4338CA, label 10px 500
Inactive: color --text-tertiary
```

**Screen 1 — Mobile Conversation List:**
```
AppBar: "กล่องข้อความ" 14px 500 + [ti-search] [ti-adjustments-horizontal] icons 19px
Filter pills: horizontal scroll, no-wrap, ไม่มี scrollbar visible
ConversationCard: เหมือน desktop แต่ avatar 38px, ไม่มี border-left active indicator
  → แทนด้วย highlight bg #EEF2FF เต็มแถว
```

**Screen 2 — Mobile Chat Window:**
```
AppBar: [ti-arrow-left 19px] [Avatar 33px] [Name + Status pill] [ti-user-circle] [ti-dots-vertical]
Messages: เหมือน desktop, max-width 76%
Input: textarea border-radius 22px (pill shape) + Send button 36px circle
Toolbar: เหมือน desktop แต่ compact (padding 6px)
```

**Screen 3 — Mobile Customer Info (full screen):**
```
Header: [ti-x] "ข้อมูลลูกค้า" 13px 500 [ti-edit]
Avatar 50px + Name 14px + LINE OA label
Section rows: status, assign, tags, quick replies
Quick Reply cards: เหมือน desktop
```

---

### 9.7 Component File Structure (Codex: สร้างไฟล์เหล่านี้)

```
apps/web/components/inbox/
├── ConversationList/
│   ├── index.tsx              ← wrapper + search + filter
│   ├── ConversationCard.tsx   ← single card component
│   └── FilterPills.tsx        ← tab filter pills
├── ChatWindow/
│   ├── index.tsx              ← layout wrapper
│   ├── ChatHeader.tsx         ← header + action buttons
│   ├── MessageBubble.tsx      ← outbound | inbound | note | system
│   ├── DateSeparator.tsx
│   └── ChatInput.tsx          ← toolbar + textarea + send
├── CustomerPanel/
│   ├── index.tsx
│   ├── AssignDropdown.tsx
│   ├── TagList.tsx
│   └── QuickReplyList.tsx
└── mobile/
    ├── MobileLayout.tsx       ← screens + bottom nav controller
    ├── BottomNav.tsx
    └── CustomerInfoSheet.tsx  ← full-screen customer info
```

### 9.8 Status Helper (ใช้ทั่วทั้งแอป)

```ts
// lib/status.ts
export const STATUS_CONFIG = {
  OPEN: {
    dot: '#1F9D72',
    text: 'เปิดอยู่',
    bg: '#ECFDF5',
    border: '#6EE7B7',
    avatarText: '#065F46',
  },
  PENDING: {
    dot: '#D97706',
    text: 'รอแอดมิน',
    bg: '#FFFBEB',
    border: '#FCD34D',
    avatarText: '#92400E',
  },
  RESOLVED: {
    dot: '#9A9DB0',
    text: 'ปิดแล้ว',
    bg: 'var(--bg-base)',
    border: 'var(--border)',
    avatarText: 'var(--text-secondary)',
  },
} as const

export type ConvStatus = keyof typeof STATUS_CONFIG
```

### 9.9 Responsive Breakpoint

```ts
// ใช้ Tailwind breakpoint
// md: (768px+) → Desktop 3-panel
// < md         → Mobile single screen + Bottom Nav

// layout.tsx
<div className="hidden md:flex h-screen"> {/* Desktop */} </div>
<div className="flex md:hidden flex-col h-screen"> {/* Mobile */} </div>
```

---

## 10. ✅ Master Checklist สำหรับ Codex

### Phase 0 — Infrastructure (ทำก่อน ไม่งั้นระบบพัง)
- [ ] Supabase: เปลี่ยน DATABASE_URL เป็น Transaction Pooler port 6543
- [ ] Supabase: เพิ่ม DIRECT_URL port 5432 สำหรับ prisma migrate
- [ ] schema.prisma: เพิ่ม directUrl field
- [ ] Render: Upgrade Starter plan
- [ ] SQL: รัน CREATE INDEX CONCURRENTLY บนทุกตาราง (tenant_id)

### Phase 1 — Batch 1: Multi-Tenant UI
- [ ] `/app/(auth)/tenant-select` — Tenant Switcher page
- [ ] `/app/settings/team` — Team management + invite form
- [ ] `/invite/accept?token=` — Accept invitation page
- [ ] JWT middleware รองรับ tenantId claim

### Phase 2 — Batch 2: Chat UX Redesign
- [ ] ConversationList component (ตาม spec 9.3)
- [ ] ConversationCard + StatusConfig helper (ตาม spec 9.8)
- [ ] ChatWindow layout (ตาม spec 9.4)
- [ ] MessageBubble: outbound/inbound/note/system variants
- [ ] ChatInput: toolbar + send (ตาม spec 9.4)
- [ ] CustomerPanel (ตาม spec 9.5)
- [ ] Mobile Layout + BottomNav (ตาม spec 9.6)
- [ ] Responsive breakpoint md: (ตาม spec 9.9)

### Phase 3 — Batch 3: Real-time + Media (ควบคู่ BullMQ)
- [ ] `npm install @nestjs/bullmq bullmq`
- [ ] BullMQ Module + WebhookQueue + WebhookProcessor
- [ ] SSE endpoint `/sse/tenant/:tenantId` + Redis Pub/Sub broadcast
- [ ] SSE heartbeat ทุก 30 วิ ป้องกัน disconnect
- [ ] Supabase Storage bucket `chat-media` (public read)
- [ ] Media upload endpoint → return public URL → ส่ง LINE Messaging API
- [ ] Flex Message Parser component (JSON → rendered card)
- [ ] React Server Components สำหรับ ConversationList initial load
- [ ] Suspense + Skeleton ทุก async section
