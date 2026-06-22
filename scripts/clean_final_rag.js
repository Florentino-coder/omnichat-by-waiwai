// c:\Users\fluk3\Documents\all-chat-line-oa\scripts\clean_final_rag.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = 'C:\\Users\\fluk3\\Documents\\final_rag_data.json';
const OUTPUT_PATH = 'C:\\Users\\fluk3\\Documents\\all-chat-line-oa\\final_rag_data.json';

function cleanAnswer(text) {
  if (!text) return "";
  let cleaned = text;

  // 1. Remove specific English phrases with names
  cleaned = cleaned.replace(/check it for you,\s*[a-zA-Z\s0-9]+/gi, "check it for you.");

  // 2. Match: "นะคะพี่โบ", "นะคะ พี่โบ", "นะครับ พี่เด่น", "นะครับพี่เด่น", "น๊าพี่โบ", "น้าพี่โบ", "น๊า พี่โบ", "นะคะพี่Noonet", "น๊าพี่Noonet", "นะค่ะพี่..."
  // Replace with standard polite ending "นะคะ" or "นะครับ" or "ค่ะ" or "ครับ"
  cleaned = cleaned.replace(/(นะครับ|ครับผม|นะค่ะ|นะคะ|นะค๊า|ครับ|ค่า|ค่ะ|น๊า|น้า)\s*(คุณพี่|พี่|คุณ)\s*([a-zA-Zก-๙]{1,15})/gi, "$1");
  
  // English names with polite suffixes
  cleaned = cleaned.replace(/(นะครับ|ครับผม|นะค่ะ|นะคะ|นะค๊า|ครับ|ค่า|ค่ะ|น๊า|น้า)\s*(คุณพี่|พี่|คุณ)\s*([a-zA-Z]{1,15})/gi, "$1");

  // 3. Clean up names at the end of the sentence that don't have prefix (e.g. "นะคะบี", "นะคะเกมส์ 🍰")
  // Using ([^ก-๙a-zA-Z]*)$ to capture emojis, spaces, and symbols at the end and keep them
  cleaned = cleaned.replace(/(นะครับ|ครับผม|นะค่ะ|นะคะ|นะค๊า|ครับ|ค่า|ค่ะ|น๊า|น้า)\s*(คุณพี่|พี่|คุณ)?\s*([ก-๙a-zA-Z]{1,12})([^ก-๙a-zA-Z]*)$/gi, "$1$4");

  // 4. Match at start of string: "พี่โบ น้องตรวจสอบ...", "พี่นะ รบกวนรอสักครู่..."
  // Remove the name prefix but keep the main verb/subject
  cleaned = cleaned.replace(/^(คุณพี่|พี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z]{1,15})\s*(น้อง|รบกวน|ทำการ|ระบบ|ยอด|เครดิต|กำลัง|ช่วย|ขอ|เช็ค|ตรวจสอบ|รอ|ยินดี|ระบบ)/gi, "$3");
  
  // General start of string prefix removal (e.g. "พี่โบ ยอดเงินเข้าแล้วนะคะ" -> "ยอดเงินเข้าแล้วนะคะ")
  cleaned = cleaned.replace(/^(คุณพี่|พี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z]{1,15})\s+/gi, "");

  // 5. Match and replace leftover "พี่[ชื่อ]" or "คุณพี่[ชื่อ]" in the middle of sentences
  cleaned = cleaned.replace(/(คุณพี่|พี่)\s*([a-zA-Zก-๙a-zA-Z0-9]{1,15})/gi, "");

  // 6. Clean up trailing brand name with name: e.g. "🍰 {{brand_name}} พี่เด่น" -> "🍰 {{brand_name}}"
  cleaned = cleaned.replace(/({{brand_name}})\s*(พี่|คุณพี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z0-9]{1,15})$/gi, "$1");
  cleaned = cleaned.replace(/\s*(พี่|คุณพี่|คุณ)\s*([a-zA-Zก-๙a-zA-Z0-9]{1,15})$/gi, "");

  // 7. Specific hardcoded English names cleanup just in case they are standalone
  const specificNames = ["Noonet", "Alan"];
  for (const name of specificNames) {
    const regex = new RegExp(`(คุณพี่|พี่|คุณ)?\\s*${name}`, 'gi');
    cleaned = cleaned.replace(regex, "");
  }

  // 8. Clean up any duplicated symbols or empty parentheses/emojis left from removal
  cleaned = cleaned.replace(/\(\s*\)/g, ""); // empty parentheses
  cleaned = cleaned.replace(/\{\s*\}/g, ""); // empty curly braces
  
  // Final trim and whitespace adjustments
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  return cleaned;
}

function processFile() {
  try {
    if (!fs.existsSync(INPUT_PATH)) {
      console.error(`❌ ไม่พบไฟล์ต้นทางที่: ${INPUT_PATH}`);
      return;
    }

    console.log(`📖 กำลังอ่านข้อมูลจาก: ${INPUT_PATH}`);
    const rawData = fs.readFileSync(INPUT_PATH, 'utf8');
    const qaPairs = JSON.parse(rawData);
    console.log(`📊 จำนวนคู่ QA ทั้งหมดที่โหลดได้: ${qaPairs.length} รายการ`);

    const cleanedPairs = [];
    let changeCount = 0;
    
    // สุ่มแสดงผลลัพธ์การแก้ไขเพื่อตรวจสอบ
    const samplesToShow = [];

    for (const pair of qaPairs) {
      const originalAnswer = pair.cleaned_answer;
      const cleanedAnswer = cleanAnswer(originalAnswer);
      
      if (originalAnswer !== cleanedAnswer) {
        changeCount++;
        if (samplesToShow.length < 15 && originalAnswer.includes("พี่") && cleanedAnswer.length > 5) {
          samplesToShow.push({
            original: originalAnswer,
            cleaned: cleanedAnswer
          });
        }
      }

      cleanedPairs.push({
        cleaned_question: pair.cleaned_question,
        cleaned_answer: cleanedAnswer,
        frequency: pair.frequency
      });
    }

    console.log(`✨ การแปลงข้อมูลเสร็จสิ้น!`);
    console.log(`🔄 มีการแก้ไขคำตอบไปทั้งหมด: ${changeCount} / ${qaPairs.length} รายการ`);
    
    console.log(`\n🔍 ตัวอย่างการเปรียบเทียบก่อน-หลังการล้างข้อมูล:`);
    samplesToShow.forEach((sample, index) => {
      console.log(`[ตัวอย่างที่ ${index + 1}]`);
      console.log(`❌ ก่อน: ${sample.original}`);
      console.log(`✅ หลัง: ${sample.cleaned}`);
      console.log(`--------------------------------------------------`);
    });

    // บันทึกไฟล์ใหม่ลงในโฟลเดอร์หลักของโปรเจกต์
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleanedPairs, null, 2), 'utf8');
    console.log(`💾 บันทึกไฟล์ที่ล้างเสร็จแล้วไปที่: ${OUTPUT_PATH}`);
    
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการรันสคริปต์:`, error);
  }
}

processFile();
