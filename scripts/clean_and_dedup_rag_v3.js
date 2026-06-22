// c:\Users\fluk3\Documents\all-chat-line-oa\scripts\clean_and_dedup_rag_v3.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ต้นทางจากโฟลเดอร์เก็บ LINE Chat logs ดิบดั้งเดิม
const INPUT_PATH = 'C:\\Users\\fluk3\\Documents\\line_oa_chat_csv_260404_170615\\final_rag_data.json';
// ปลายทางที่จะบันทึกทับในโฟลเดอร์หลักของโปรเจกต์
const OUTPUT_PATH = 'C:\\Users\\fluk3\\Documents\\all-chat-line-oa\\final_rag_data.json';

// Regex กรองสบถและคำหยาบคาย/คำอารมณ์เสียของลูกค้าที่ไม่เป็นประโยชน์ต่อ RAG
const abuseRegex = /เหี้ย|สัส|ตอแหล|แดก|ควบ|ควย|เย็ด|หี|แตด|มึง|กู|กุ|มุึง|สัสนรก/gi;

// คำสร้อยและประโยคทักทายเดี่ยวๆ ที่ไม่ต้องการนำมาทำเป็นหัวข้อ RAG
const noiseQuestions = new Set([
  "ครับ", "คับ", "ค่ะ", "จ้า", "คะ", "ครับผม", "แอด", "ขอบคุณครับ", "ขอบคุณค่ะ", "ขอบคุณ",
  "สวัสดีค่ะ", "สวัสดีครับ", "สวัสดี", "โอเค", "ok", "เค", "เคร", "เคคับ", "เคค่ะ", "จ้าพี่",
  "แป๊บ", "แป๊บนะ", "แปป", "แปปนะ", "อาเค", "เครครับ", "เครค่ะ", "จ้าๆ", "ครับๆ", "ค่ะๆ",
  "นะ", "หรอ", "คะพี่", "ค่ะพี่", "ครับพี่", "ป่าว", "เปล่า", "ฮัลโหล", "ฮาโหล", "โหล",
  "เออ", "จร้", ". . .", "ดีค่ะ", "ดีครับ", "คับบ", "ครับบ", "คั", "บ", "คุน", "ขอบคุนครับ",
  "ขอบคุนคับ", "ได้แล้วครับขอบคุณครับ", "เข้าแล้วค่ะ", "หมด", "'@", "ครับบ", "ยังค่ะ",
  "จ้าขอบคุณค่ะ", "เห้อ", "งือ", "เง้อ", "อ้าว", "เอ้า", "ออ", "อ้อ", "อ่า", "อ่าว",
  "เดี๋ยว", "เด่ว", "เด่วก่อน", "ก่อน", "แปบนึง", "แปปนึง", "แปปป", "เอาอีกแล้ววววว",
  "เอาอีกแล้ว", "อีกแล้ว"
]);

// ตารางมาตรฐานสำหรับจับกลุ่มคำถาม (Core FAQ Categories)
const categories = [
  {
    id: "deposit",
    title: "แจ้งฝากเงินแล้วยอดไม่เข้า",
    keywords: new Set(),
    answers: {},
    match: (q) => {
      const qLower = q.toLowerCase();
      // กรองคำหลักของหมวดหมู่อื่นออกก่อน เพื่อไม่ให้แมปไขว้
      if (/ถอน|สมัคร|สมัค|รหัส|พาส| RAG |เอกสาร/i.test(qLower)) return false;
      
      // คีย์เวิร์ดกว้างสำหรับฝากเงิน (รวมถึงการแจ้งโอน เติมเงิน ยอดยังไม่ปรับ)
      return /ฝาก|โอน|เติม|ยอด|เงิน|ตัง|เครดิต|สลิป|ปรับยอด|ปรับเครดิต|ไม่เข้า|ยังไม่เข้า|ไม่ปรับ/i.test(qLower);
    }
  },
  {
    id: "withdraw",
    title: "แจ้งถอนเงินแล้วยังไม่ได้รับยอด",
    keywords: new Set(),
    answers: {},
    match: (q) => {
      const qLower = q.toLowerCase();
      // กรองคำหลักของฝากเงินหรือสมัครสมาชิกออก
      if (/ฝาก|สมัคร|สมัค|รหัส|พาส/i.test(qLower)) return false;
      
      // คีย์เวิร์ดสำหรับถอนเงิน
      return /ถอน/i.test(qLower);
    }
  },
  {
    id: "forgot_password",
    title: "ลืมรหัสผ่าน / เข้าสู่ระบบไม่ได้",
    keywords: new Set(),
    answers: {},
    match: (q) => {
      const qLower = q.toLowerCase();
      return /ลืมรหัส|ลืมพาส|จำรหัสไม่ได้|ขอรหัส|เข้าสู่ระบบไม่ได้|รีรหัส|ลืมรหัสผ่าน/i.test(qLower);
    }
  },
  {
    id: "free_credit",
    title: "การขอรับเครดิตฟรี / สมาชิกใหม่",
    keywords: new Set(),
    answers: {},
    match: (q) => {
      const qLower = q.toLowerCase();
      return /เครดิตฟรี|ทุนฟรี|รับทุน|ฟรีเครดิต|ขอรับเครดิต/i.test(qLower);
    }
  },
  {
    id: "register",
    title: "วิธีการสมัครสมาชิกใหม่",
    keywords: new Set(),
    answers: {},
    match: (q) => {
      const qLower = q.toLowerCase();
      return /สมัคร|สมัค/i.test(qLower);
    }
  },
  {
    id: "rtp_recommend",
    title: "ขอช่วงเวลาเกมแตกดี / แนะนำเกมน่าเล่น",
    keywords: new Set(),
    answers: {},
    match: (q) => {
      const qLower = q.toLowerCase();
      return /เวลาเกม|เกมไหนแตก|ขอสูตร|แนะนำเกม|แตกดี|ขอเวลา/i.test(qLower);
    }
  },
  {
    id: "contact_admin",
    title: "ติดต่อแอดมิน / คุยกับเจ้าหน้าที่",
    keywords: new Set(),
    answers: {},
    match: (q) => {
      const qLower = q.toLowerCase();
      return /แอด|ติดต่อ|เจ้าหน้าที่|คุยกับแอดมิน/i.test(qLower);
    }
  }
];

function getManualMapping(q) {
  const qLower = q.trim().toLowerCase();
  if (["ฝาก", "ฝากจ้า", "ฝากค่ะ", "ฝากครับ", "แจ้งฝากค่ะ", "ยอดฝากคะ", "ยอดฝาก", "เติมเงิน", "แจ้งฝาก", "โอนแล้ว", "โอนเงินแล้ว"].includes(qLower)) {
    return "deposit";
  }
  if (["ถอน", "ถอนค่ะ", "ถอนครับ", "แจ้งถอนคะ", "แจ้งถอนค่ะ", "แจ้งถอน", "ถอนตัง", "แจ้งถอนเงิน"].includes(qLower)) {
    return "withdraw";
  }
  if (["สมัคร", "สมัค", "สมัครสมาชิกครับ", "สมัครสมาชิกให้หน่อย", "สมัคสมาชิก"].includes(qLower)) {
    return "register";
  }
  return null;
}

// ฟังก์ชันล้างชื่อแอดมินและลูกค้าออกจากคำตอบ
function cleanAnswer(text) {
  if (!text) return "";
  let cleaned = text;

  cleaned = cleaned.replace(/check it for you,\s*[a-zA-Z\s0-9]+/gi, "check it for you.");

  cleaned = cleaned.replace(/(นะครับ|ครับผม|นะค่ะ|นะคะ|นะค๊า|ครับ|ค่า|ค่ะ|น๊า|น้า)\s*(คุณพี่|พี่|คุณ)\s*([a-zA-Zก-๙]{1,15})/gi, "$1");
  cleaned = cleaned.replace(/(นะครับ|ครับผม|นะค่ะ|นะคะ|นะค๊า|ครับ|ค่า|ค่ะ|น๊า|น้า)\s*(คุณพี่|พี่|คุณ)\s*([a-zA-Z]{1,15})/gi, "$1");

  // ล้างชื่อลูกค้าที่ไม่มีคำนำหน้าท้ายประโยค
  cleaned = cleaned.replace(/(นะครับ|ครับผม|นะค่ะ|นะคะ|นะค๊า|ครับ|ค่า|ค่ะ|น๊า|น้า)\s*(คุณพี่|พี่|คุณ)?\s*([ก-๙a-zA-Z]{1,12})([^ก-๙a-zA-Z]*)$/gi, "$1$4");

  cleaned = cleaned.replace(/^(คุณพี่|พี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z]{1,15})\s*(น้อง|รบกวน|ทำการ|ระบบ|ยอด|เครดิต|กำลัง|ช่วย|ขอ|เช็ค|ตรวจสอบ|รอ|ยินดี|ระบบ)/gi, "$3");
  cleaned = cleaned.replace(/^(คุณพี่|พี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z]{1,15})\s+/gi, "");

  cleaned = cleaned.replace(/(คุณพี่|พี่)\s*([a-zA-Zก-๙a-zA-Z0-9]{1,15})/gi, "");

  cleaned = cleaned.replace(/({{brand_name}})\s*(พี่|คุณพี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z0-9]{1,15})$/gi, "$1");
  cleaned = cleaned.replace(/\s*(พี่|คุณพี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z0-9]{1,15})$/gi, "");

  const specificNames = ["Noonet", "Alan"];
  for (const name of specificNames) {
    const regex = new RegExp(`(คุณพี่|พี่|คุณ)?\\s*${name}`, 'gi');
    cleaned = cleaned.replace(regex, "");
  }

  cleaned = cleaned.replace(/\(\s*\)/g, "");
  cleaned = cleaned.replace(/\{\s*\}/g, "");
  
  return cleaned.replace(/\s+/g, " ").trim();
}

function cleanQuestion(q) {
  if (!q) return "";
  let cleaned = q.replace(/คุณส่งรูป/g, "")
                 .replace(/คุณส่งสติกเกอร์/g, "")
                 .replace(/ส่งสติกเกอร์/g, "")
                 .replace(/\s+/g, " ")
                 .trim();
  return cleaned;
}

function process() {
  try {
    if (!fs.existsSync(INPUT_PATH)) {
      console.error(`❌ ไม่พบไฟล์ข้อมูล RAG ดิบดั้งเดิมที่: ${INPUT_PATH}`);
      return;
    }

    console.log(`📖 กำลังอ่านข้อมูล RAG ดิบดั้งเดิมจาก: ${INPUT_PATH}`);
    const rawData = fs.readFileSync(INPUT_PATH, 'utf8');
    const qaPairs = JSON.parse(rawData);
    console.log(`📊 จำนวนข้อมูลดิบทั้งหมด: ${qaPairs.length} รายการ`);

    const phoneRegex = /\d{9,10}/;
    const standaloneGrouped = {};

    let totalAbuseFiltered = 0;
    let totalNoiseFiltered = 0;
    let totalPhoneFiltered = 0;

    qaPairs.forEach(item => {
      const origQ = item.cleaned_question;
      const origA = cleanAnswer(item.cleaned_answer);
      const freq = item.frequency;

      const q = cleanQuestion(origQ);
      if (!q) return;

      // 1. กรองเบอร์โทรศัพท์
      if (phoneRegex.test(q.replace(/[-\s]/g, ''))) {
        totalPhoneFiltered++;
        return;
      }

      // 2. กรองคำหยาบคาย/อารมณ์เสีย
      if (abuseRegex.test(q)) {
        totalAbuseFiltered++;
        return;
      }

      const qLower = q.toLowerCase();

      // 3. กรองคำทักทายหรือคำสร้อยเดี่ยวๆ ที่ไม่มีเนื้อหา RAG
      if (noiseQuestions.has(qLower)) {
        totalNoiseFiltered++;
        return;
      }

      // ตรวจสอบการ Map เข้าหมวดหมู่หลัก (Core Categories)
      let mappedCategoryId = getManualMapping(q);
      
      if (!mappedCategoryId) {
        const matchedCat = categories.find(cat => cat.match(q));
        if (matchedCat) {
          mappedCategoryId = matchedCat.id;
        }
      }

      if (mappedCategoryId) {
        const cat = categories.find(c => c.id === mappedCategoryId);
        cat.keywords.add(q);
        if (!cat.answers[origA]) {
          cat.answers[origA] = 0;
        }
        cat.answers[origA] += freq;
      } else {
        // หากไม่ตรงกับหมวดหมู่แกนกลาง แต่เป็นคำถามที่มีประโยชน์ให้เก็บเป็นแบบ Standalone
        // เช่น "ฝากถอนขั้นต่ำ"
        if (q.length < 4) {
          // กรองคำที่สั้นเกินไปและไม่ได้แมปออกเพื่อความปลอดภัย
          totalNoiseFiltered++;
          return;
        }

        if (!standaloneGrouped[q]) {
          standaloneGrouped[q] = {};
        }
        if (!standaloneGrouped[q][origA]) {
          standaloneGrouped[q][origA] = 0;
        }
        standaloneGrouped[q][origA] += freq;
      }
    });

    const finalArticles = [];

    // 1. ประกอบบทความของหมวดหมู่แกนหลัก (Core Category Articles)
    categories.forEach(cat => {
      // ค้นหาคำตอบที่ดีที่สุดและใช้บ่อยที่สุดของหมวดหมู่นี้
      let bestAnswer = "";
      let maxFreq = 0;
      let totalFreqSum = 0;

      Object.keys(cat.answers).forEach(a => {
        const f = cat.answers[a];
        totalFreqSum += f;
        if (f > maxFreq) {
          maxFreq = f;
          bestAnswer = a;
        }
      });

      if (bestAnswer && bestAnswer.length > 5) {
        finalArticles.push({
          cleaned_question: cat.title,
          cleaned_answer: bestAnswer,
          frequency: totalFreqSum,
          keywords: Array.from(cat.keywords)
        });
      }
    });

    // 2. ประกอบบทความแบบ Standalone
    Object.keys(standaloneGrouped).forEach(q => {
      const answers = standaloneGrouped[q];
      let bestAnswer = "";
      let maxFreq = 0;
      let totalFreqSum = 0;

      Object.keys(answers).forEach(a => {
        const f = answers[a];
        totalFreqSum += f;
        if (f > maxFreq) {
          maxFreq = f;
          bestAnswer = a;
        }
      });

      if (bestAnswer && bestAnswer.length > 5) {
        finalArticles.push({
          cleaned_question: q,
          cleaned_answer: bestAnswer,
          frequency: totalFreqSum,
          keywords: [q]
        });
      }
    });

    // เรียงลำดับตามความถี่
    finalArticles.sort((a, b) => b.frequency - a.frequency);

    // บันทึกไฟล์ที่ลดขยะสมบูรณ์แบบ
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalArticles, null, 2), 'utf8');

    console.log(`==================================================`);
    console.log(`🧹 การลดความซ้ำซ้อนระดับสูงสุดเสร็จสมบูรณ์!`);
    console.log(`   - จำนวนคำถามขยะ/หยาบคายที่ลบ: ${totalAbuseFiltered} รายการ`);
    console.log(`   - จำนวนเบอร์โทรศัพท์ลูกค้าที่ลบ: ${totalPhoneFiltered} รายการ`);
    console.log(`   - จำนวนคำรับสร้อย/สั้นเกะกะที่ลบ: ${totalNoiseFiltered} รายการ`);
    console.log(`   - บทความคุณภาพที่ถูกสร้างขึ้น RAG: ${finalArticles.length} รายการ`);
    console.log(`💾 บันทึกไฟล์สะอาดขั้นสุดไปที่: ${OUTPUT_PATH}`);
    console.log(`==================================================`);

  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการล้างข้อมูลเวอร์ชัน 3:`, error);
  }
}

process();
