# Chat-Wai: AI Suggested Reply + Customer Entity — Technical Spec

> เอกสารนี้เขียนไว้ให้ AI coding assistant (เช่น Gemini) ใช้เป็น context ในการ implement โดยตรง อ่านครบทุก section ก่อนเริ่มเขียนโค้ด

## 1. เป้าหมาย (Goal)

สร้างฟีเจอร์ **AI Suggested Reply**: Agent กดปุ่มในหน้าแชท → AI ร่างคำตอบให้ → Agent ตรวจ/แก้ไข/ส่ง
AI ต้องรู้จักลูกค้า (ชื่อ, แท็ก, โน้ตภายในทีม) เพื่อให้คำตอบเป็นส่วนตัวและปลอดภัย เช่น ถ้ามีโน้ตว่า "ลูกค้าแพ้กุ้ง" AI ต้องไม่แนะนำเมนูที่มีกุ้ง

LLM provider เริ่มต้น: **Gemini** (แต่ implement แบบ provider-agnostic ดู section 8 — ห้าม hardcode ผูกกับ Gemini ตรงๆ ในชั้น business logic เพราะอนาคตอาจ swap)

## 2. สถานะระบบปัจจุบัน (Current State — สำคัญ อ่านก่อนแก้โค้ด)

| ส่วน | สถานะ |
|---|---|
| LINE OA webhook, DB save, Redis Pub/Sub, SSE realtime | ✅ มีแล้ว ทำงานได้ |
| Tags (เพิ่ม/ลบ/แสดงผล) | ✅ มีแล้ว — **แต่ผูกกับ `conversation`, ไม่ใช่ลูกค้า** |
| Internal Notes (เพิ่ม/แสดงผล) | ✅ มีแล้ว — **แต่ผูกกับ `conversation`, ไม่ใช่ลูกค้า** |
| ตาราง `customers` แยกต่างหาก | ❌ ไม่มี — ชื่อที่แสดง (เช่น "F") ดึงจาก LINE platform สดๆ ทุกครั้ง ไม่ persist เป็น entity |
| AI ใดๆ ในระบบ | ❌ ไม่มี |

**กฎสำคัญ**: ห้ามแก้ logic ของ Tags/Notes ที่มีอยู่แล้ว งานนี้แค่ "อ่าน" ข้อมูลเดิมเพิ่ม ไม่ใช่เขียนระบบ Tags/Notes ใหม่

## 3. ขอบเขตงาน (Scope)

ทำ 3 อย่าง:
- **A.** สร้าง Customer Entity (CRM ขั้นต่ำ) — ตาราง `customers` ที่แยกจาก conversation
- **B.** Migrate ข้อมูลเดิม ให้ conversation ทุกอันมี `customer_id` (tags/notes เดิมจะเข้าถึงได้ทางอ้อมผ่าน conversation → customer)
- **C.** AI Suggested Reply — context builder ดึง (ข้อความล่าสุด + ชื่อลูกค้า + tags + notes) → ส่งให้ LLM → ได้ suggestion ให้ agent ตรวจก่อนส่ง

**ไม่อยู่ในขอบเขตนี้**: AI Auto Reply (ตอบเองอัตโนมัติ), Knowledge Base / semantic search, Full AI Agent (tool calling), Facebook/IG/Telegram channels

## 4. Database Schema

```sql
-- ตารางใหม่: customers (entity หลักของลูกค้า)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(255),
  avatar_url TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- เชื่อม channel user id (LINE userId) เข้ากับ customer
-- ออกแบบเป็นตารางแยกเพราะอนาคต 1 ลูกค้าอาจมีหลายช่องทาง (FB, IG)
CREATE TABLE customer_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel_type VARCHAR(20) NOT NULL,        -- 'line' | 'facebook' | 'instagram' | ...
  channel_user_id VARCHAR(255) NOT NULL,    -- LINE userId เดิมที่ระบบมีอยู่แล้ว
  UNIQUE (channel_type, channel_user_id)
);

-- แก้ตาราง conversations เดิม: เพิ่ม column เดียว ห้ามแก้อย่างอื่น
ALTER TABLE conversations ADD COLUMN customer_id UUID REFERENCES customers(id);

-- เก็บ log การ suggest ของ AI ทุกครั้ง (ใช้ทำ analytics ภายหลังด้วย)
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  action_type VARCHAR(20) NOT NULL DEFAULT 'generate', -- generate | rewrite | shorter | polite | friendly
  prompt_used TEXT,
  suggestion_text TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'shown',          -- shown | edited | sent | rejected
  final_sent_text TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- เก็บ system prompt แบบแก้ได้ไม่ต้อง deploy ใหม่
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  system_prompt TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT now()
);
```

## 5. Migration Plan (ข้อมูลเก่า — ทำตามลำดับนี้เท่านั้น)

1. รัน migration สร้างตาราง `customers`, `customer_channels` (ว่างเปล่า) และเพิ่ม column `customer_id` ใน `conversations`
2. เขียน script (รันครั้งเดียว) loop ทุก `conversation` ที่มีอยู่:
   - ดึง LINE `userId` ของ conversation นั้น
   - ถ้ายังไม่มี customer ที่ผูกกับ userId นี้ → insert ลง `customers` (ใช้ display_name/avatar ปัจจุบันจาก LINE เป็นค่าเริ่มต้น) + insert `customer_channels`
   - ถ้ามีแล้ว (กรณีลูกค้าคนเดิมมีหลาย conversation) → ใช้ customer_id เดิม
   - `UPDATE conversations SET customer_id = ...`
3. **Verify**: query นับจำนวน tags และ notes ทั้งหมดก่อน/หลัง migration ต้องเท่ากัน (เพราะ tags/notes ไม่ถูกย้าย แค่ conversation ที่มันผูกอยู่ได้ customer_id เพิ่มเข้ามา)
4. รัน migration บน staging ก่อนเสมอ ห้ามรันตรงบน production โดยไม่ test

## 6. API Endpoints

### `GET /customers/:id`
```json
{
  "id": "uuid",
  "display_name": "string",
  "avatar_url": "string",
  "phone": "string|null",
  "email": "string|null",
  "tags": ["ลูกค้าใหม่", "การตลาด"],
  "notes": [{ "text": "string", "created_at": "iso8601" }]
}
```
*หมายเหตุ: `tags`/`notes` ดึงผ่าน conversation ที่ผูกกับ customer_id นี้ ใช้ query/endpoint เดิมที่มีอยู่แล้ว ไม่ต้องสร้าง logic ใหม่*

### `PATCH /customers/:id`
Body: `{ display_name?, phone?, email? }`

### `POST /conversations/:id/ai-suggest`
Body:
```json
{ "action_type": "generate" }
```
`action_type` เป็นหนึ่งใน: `generate | rewrite | shorter | polite | friendly`

Response:
```json
{ "suggestion_id": "uuid", "suggestion_text": "string" }
```

**Logic ภายใน endpoint (ทำตามลำดับ):**
1. ดึง `conversation` → ได้ `customer_id`
2. ดึงข้อความล่าสุด 10-15 ข้อความของ conversation นี้
3. ดึง `customer.display_name`, `tags`, `notes` ผ่าน `customer_id`
4. ประกอบ prompt ตาม section 7
5. เรียก LLM ผ่าน LLM Client Wrapper (section 8)
6. บันทึกผลลง `ai_suggestions` (status='shown')
7. ส่ง `suggestion_text` กลับ

## 7. AI Context Builder & Prompt Structure

เก็บ system prompt นี้ไว้ใน `prompt_templates` (name = `'suggested_reply_default'`) ไม่ hardcode ในโค้ด:

```
คุณเป็นผู้ช่วย Agent ร้านค้าที่กำลังตอบแชทลูกค้าผ่าน LINE OA

ชื่อลูกค้า: {{customer_name}}
แท็กลูกค้า: {{tags}}
โน้ตภายในทีม (ข้อมูลสำคัญ ห้ามฝ่าฝืนเด็ดขาด): {{notes}}

ประวัติการสนทนาล่าสุด:
{{conversation_history}}

คำสั่งสำหรับ action_type = {{action_type}}:
- generate: ร่างคำตอบใหม่ สุภาพ กระชับ ตรงประเด็น
- rewrite: เขียนใหม่ความหมายเดิมแต่สำนวนต่าง
- shorter: ย่อข้อความล่าสุดที่ agent พิมพ์ให้สั้นลง
- polite: ปรับให้สุภาพขึ้น
- friendly: ปรับให้เป็นกันเองขึ้น

ตอบเป็นข้อความเดียวที่พร้อมส่งจริง ไม่ต้องมีคำอธิบายเพิ่มเติม ไม่ต้องใส่ quote
```

**กฎสำคัญ**: ถ้า `{{notes}}` มีข้อมูลอ่อนไหว (เช่น แพ้อาหาร, ข้อร้องเรียนเดิม) ต้อง inject เข้า prompt เสมอ ห้ามตัดทิ้งแม้ context จะยาวเกิน — ตัด `conversation_history` แทนถ้าจำเป็นต้องลด token

## 8. LLM Client Wrapper (ต้อง provider-agnostic)

```typescript
interface LLMClient {
  generateReply(params: {
    systemPrompt: string;
    conversationHistory: { role: 'customer' | 'agent'; text: string }[];
  }): Promise<string>;
}
```

Implement แยกตาม provider: `GeminiClient implements LLMClient`, `OpenAIClient implements LLMClient`, `ClaudeClient implements LLMClient`
เลือก provider ที่ใช้งานจริงผ่าน **environment variable เดียว** (เช่น `LLM_PROVIDER=gemini`) — business logic (context builder, endpoint) เรียกผ่าน interface เท่านั้น ห้ามอ้างถึงชื่อ provider ตรงๆ นอก client implementation

## 9. Frontend Requirements

**Customer Sidebar** (พื้นที่ "ข้อมูลลูกค้า" ที่มีอยู่แล้วในหน้าแชท)
- แสดง `display_name`, `avatar` — ดึงจาก `customer_id` ของ conversation ที่เปิดอยู่
- เพิ่มฟิลด์ `phone`, `email` ที่แก้ไขได้ (ตอนนี้ไม่มีในระบบ ต้องสร้างใหม่)
- ส่วน Tags / Notes: **ใช้ component เดิมที่มีอยู่แล้วทั้งหมด ไม่ต้องสร้างใหม่**

**AI Suggest** (ในกล่องพิมพ์ข้อความด้านล่าง)
- ปุ่ม "AI Suggest" → เรียก `POST /ai-suggest` (`action_type: generate`) → แสดง loading
- ผลลัพธ์ → ใส่ใน textarea ที่แก้ไขได้ก่อนส่ง (ห้าม auto-send)
- ปุ่มย่อยใต้ suggestion: Rewrite / Shorter / More Polite / More Friendly → เรียก endpoint เดิมด้วย `action_type` ต่างกัน
- เมื่อ agent กดส่งจริง → อัปเดต `ai_suggestions.status` เป็น `'sent'` (ถ้าไม่ได้แก้) หรือ `'edited'` (ถ้าแก้ข้อความก่อนส่ง) พร้อมบันทึก `final_sent_text`
- ถ้า agent ลบ suggestion ทิ้งไม่ส่ง → `status = 'rejected'`

## 10. Timeline (4 สัปดาห์ — เริ่ม 22 มิ.ย. 2026)

| สัปดาห์ | ช่วงวันที่ | งานหลัก |
|---|---|---|
| 1 | 22–26 มิ.ย. | สร้าง `customers`, `customer_channels`, migration script + LLM client wrapper + context builder v1 |
| 2 | 29 มิ.ย.–3 ก.ค. | `ai_suggestions` table + endpoint `/ai-suggest` + prompt template + error handling |
| 3 | 6–10 ก.ค. | Frontend: ปุ่ม AI Suggest, editable suggestion, rewrite/shorter/polite/friendly, customer sidebar (phone/email) |
| 4 | 13–17 ก.ค. | QA, วัด latency/cost, dogfooding, แก้บั๊ก, **soft launch** |

## 11. Definition of Done

- [ ] Agent กดปุ่ม AI Suggest แล้วได้คำตอบที่เรียกชื่อลูกค้าถูกต้อง
- [ ] ถ้าลูกค้ามี note ที่มีข้อมูลสำคัญ (เช่นแพ้อาหาร) AI ต้องไม่แนะนำสิ่งที่ขัดกับ note นั้น
- [ ] Tags/Notes เดิมทั้งหมดไม่หาย และนับจำนวนได้เท่าเดิมหลัง migration
- [ ] Latency เฉลี่ยของ `/ai-suggest` ต่ำกว่า 5 วินาที
- [ ] มี log การ accept/edit/reject ครบใน `ai_suggestions` สำหรับวัด acceptance rate ภายหลัง
- [ ] Swap LLM provider ได้โดยแก้แค่ environment variable ไม่ต้องแก้ business logic

## 12. ข้อห้าม (สำคัญสำหรับ AI ที่ implement)

- ห้ามแก้โครงสร้างตาราง `conversations` เกินกว่าที่ระบุ (เพิ่ม column `customer_id` เท่านั้น)
- ห้ามลบหรือแก้ logic ของ Tags/Notes ที่มีอยู่แล้ว
- ห้าม hardcode เรียก Gemini API ตรงๆ นอก `GeminiClient` — ต้องผ่าน `LLMClient` interface เสมอ
- ห้ามรัน migration script บน production ก่อน verify บน staging
