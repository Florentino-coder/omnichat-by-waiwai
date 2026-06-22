// c:\Users\fluk3\Documents\all-chat-line-oa\scripts\clean_and_dedup_rag.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '..', 'final_rag_data.json');

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
    if (!fs.existsSync(DATA_PATH)) {
      console.error(`❌ ไม่พบไฟล์ข้อมูล RAG ที่: ${DATA_PATH}`);
      return;
    }

    console.log(`📖 กำลังอ่านข้อมูล RAG ที่จะนำมาลดความซ้ำซ้อนจาก: ${DATA_PATH}`);
    const rawData = fs.readFileSync(DATA_PATH, 'utf8');
    const qaPairs = JSON.parse(rawData);
    console.log(`📊 จำนวนข้อมูลเดิมก่อนลดความซ้ำซ้อน: ${qaPairs.length} รายการ`);

    const phoneRegex = /\d{9,10}/;
    
    // คำตอบรับคำทักทายเดี่ยวๆ ที่ไม่มีน้ำหนักทางข้อมูล RAG ให้ตัดออก
    const noiseQuestions = new Set([
      "ครับ", "คับ", "ค่ะ", "จ้า", "คะ", "ครับผม", "แอด", "ขอบคุณครับ", "ขอบคุณค่ะ", "ขอบคุณ",
      "สวัสดีค่ะ", "สวัสดีครับ", "สวัสดี", "โอเค", "ok", "เค", "เคร", "เคคับ", "เคค่ะ", "จ้าพี่",
      "แป๊บ", "แป๊บนะ", "แปป", "แปปนะ", "อาเค", "เครครับ", "เครค่ะ", "จ้าๆ", "ครับๆ", "ค่ะๆ",
      "นะ", "หรอ", "คะพี่", "ค่ะพี่", "ครับพี่", "ป่าว", "เปล่า", "ฮัลโหล", "ฮาโหล", "โหล"
    ]);

    const grouped = {};

    qaPairs.forEach(item => {
      const origQ = item.cleaned_question;
      const origA = item.cleaned_answer;
      const freq = item.frequency;

      const q = cleanQuestion(origQ);
      if (!q) return; // กรองออกถ้าเป็นคำถามว่าง (ซึ่งแปลว่าเป็นแค่ส่งรูป/ส่งสติกเกอร์อย่างเดียว)

      // กรองเบอร์โทรศัพท์ทิ้ง เพื่อความเป็นส่วนตัวและความปลอดภัย (ป้องกัน AI จำเบอร์ลูกค้าคนอื่นไปตอบ)
      if (phoneRegex.test(q.replace(/[-\s]/g, ''))) return;

      // กรองคำทักทายสั้นๆ หรือคำรับธรรมดาที่ไม่มีข้อมูลสำคัญออก
      if (noiseQuestions.has(q.toLowerCase())) return;

      if (!grouped[q]) {
        grouped[q] = {};
      }

      if (!grouped[q][origA]) {
        grouped[q][origA] = 0;
      }
      grouped[q][origA] += freq;
    });

    const finalPairs = [];

    // คัดกรองให้แต่ละคำถามเหลือเพียงคำตอบที่ดีที่สุดและพบบ่อยที่สุดเพียง 1 คำตอบ (เพื่อความเฉียบคมของ RAG)
    Object.keys(grouped).forEach(q => {
      const answers = grouped[q];
      let bestAnswer = "";
      let maxFreq = 0;
      let totalQFreq = 0;

      Object.keys(answers).forEach(a => {
        const f = answers[a];
        totalQFreq += f;
        if (f > maxFreq) {
          maxFreq = f;
          bestAnswer = a;
        }
      });

      // กรองเพิ่มเติม: คำตอบต้องไม่สั้นเกินไป และมีคุณภาพ
      if (bestAnswer.length < 5) return;

      finalPairs.push({
        cleaned_question: q,
        cleaned_answer: bestAnswer,
        frequency: totalQFreq
      });
    });

    // เรียงความถี่จากมากไปน้อย
    finalPairs.sort((a, b) => b.frequency - a.frequency);

    // เขียนทับไฟล์เดิม
    fs.writeFileSync(DATA_PATH, JSON.stringify(finalPairs, null, 2), 'utf8');

    console.log(`==================================================`);
    console.log(`🎉 ลดความซ้ำซ้อนและกรอง Noise เสร็จสิ้น!`);
    console.log(`📊 จำนวนคู่ QA สะอาดคุณภาพสูงที่เหลืออยู่: ${finalPairs.length} รายการ`);
    console.log(`🗑️ ลดขนาดฐานข้อมูลลงได้: ${((qaPairs.length - finalPairs.length) / qaPairs.length * 100).toFixed(2)}%`);
    console.log(`💾 เขียนไฟล์ทับที่เดิมเรียบร้อย: ${DATA_PATH}`);
    console.log(`==================================================`);

  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการลดความซ้ำซ้อน:`, error);
  }
}

process();
