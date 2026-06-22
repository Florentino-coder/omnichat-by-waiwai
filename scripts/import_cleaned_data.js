// c:\Users\fluk3\Documents\all-chat-line-oa\scripts\import_cleaned_data.js
// หน้าที่: นำเข้าข้อมูล QA Pairs ที่ล้างแล้วจาก final_rag_data.json เข้าสู่ฐานข้อมูล RAG (KnowledgeArticle) ของ OmniChat

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// จำลอง __dirname สำหรับ ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importData() {
  try {
    // 1. ค้นหา Tenant ที่มี slug = "test-tenant" ตามที่ผู้ใช้งานเลือก
    let targetTenant = await prisma.tenant.findFirst({
      where: {
        slug: "test-tenant",
        deletedAt: null
      }
    });

    // หากไม่พบ ให้ดึง Tenant แรกในระบบเป็น Fallback
    if (!targetTenant) {
      const activeTenants = await prisma.tenant.findMany({
        where: { deletedAt: null }
      });

      if (activeTenants.length === 0) {
        console.error("❌ ไม่พบข้อมูล Tenant ในฐานข้อมูลหลักของคุณ! กรุณาสร้างบัญชีร้านค้าก่อนนำเข้าข้อมูล");
        return;
      }
      targetTenant = activeTenants[0];
    }

    const TENANT_ID = targetTenant.id;

    console.log(`==================================================`);
    console.log(`🏢 ระบบทำการเลือก Tenant เป้าหมายตามคำขอ:`);
    console.log(`   - ชื่อร้านค้า: ${targetTenant.name}`);
    console.log(`   - Slug: ${targetTenant.slug}`);
    console.log(`   - ID: ${targetTenant.id}`);
    console.log(`==================================================\n`);

    // 2. ตรวจเช็คไฟล์ข้อมูลเป้าหมาย
    let jsonPath = path.join(__dirname, '..', 'final_rag_data.json');
    if (!fs.existsSync(jsonPath)) {
      jsonPath = path.join(__dirname, '..', 'cleaned_rag_data.json');
    }
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ ไม่พบไฟล์ข้อมูลเป้าหมายทั้ง final_rag_data.json และ cleaned_rag_data.json ที่โฟลเดอร์หลักของโปรเจกต์`);
      console.error(`💡 วิธีแก้: กรุณาก๊อปปี้ไฟล์ข้อเสนอดังกล่าวมาวางไว้ในโฟลเดอร์โปรเจกต์หลัก (${path.join(__dirname, '..')}) ก่อนรันคำสั่งนี้ครับ`);
      return;
    }

    console.log(`🔍 กำลังอ่านไฟล์ข้อมูลจาก: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const qaPairs = JSON.parse(rawData);
    
    console.log(`🚀 กำลังเริ่มนำเข้าข้อมูล RAG เข้าสู่ฐานข้อมูล... จำนวนทั้งหมด: ${qaPairs.length} รายการ`);

    let importedCount = 0;
    
    // ค่อยๆ เพิ่มลงฐานข้อมูลทีละรายการ
    for (const pair of qaPairs) {
      const q = pair.cleaned_question;
      const a = pair.cleaned_answer;
      
      if (!q || !a) continue;

      // เพิ่มข้อมูลลงในตาราง KnowledgeArticle
      await prisma.knowledgeArticle.create({
        data: {
          tenantId: TENANT_ID,
          lineChannelId: null, // นำเข้าเป็นคลังข้อความ RAG กลางของร้านค้า
          title: q.substring(0, 100), // ใช้ส่วนคำถามเป็นหัวข้อบทความ
          content: a,
          keywords: [q],
          isActive: true
        }
      });
      importedCount++;
      
      if (importedCount % 500 === 0) {
        console.log(`⏳ นำเข้าไปแล้ว: ${importedCount}/${qaPairs.length} รายการ...`);
      }
    }

    console.log(`\n🎉 นำเข้าข้อมูล RAG สำเร็จเรียบร้อยทั้งหมด: ${importedCount} รายการ!`);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในขณะบันทึกข้อมูล:", error);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
