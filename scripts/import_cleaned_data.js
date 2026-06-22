// c:\Users\fluk3\Documents\all-chat-line-oa\scripts\import_cleaned_data.js
// หน้าที่: นำเข้าข้อมูล QA Pairs ที่ล้างแล้วจาก final_rag_data.json เข้าสู่ฐานข้อมูล RAG (KnowledgeArticle) ของ OmniChat

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

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

    if (!targetTenant) {
      const activeTenants = await prisma.tenant.findMany({
        where: { deletedAt: null }
      });

      if (activeTenants.length === 0) {
        console.error("❌ ไม่พบข้อมูล Tenant ในฐานข้อมูลหลักของคุณ!");
        return;
      }
      targetTenant = activeTenants[0];
    }

    const TENANT_ID = targetTenant.id;

    console.log(`==================================================`);
    console.log(`🏢 เริ่มต้นระบบนำเข้าข้อมูลสำหรับ Tenant:`);
    console.log(`   - ชื่อร้านค้า: ${targetTenant.name}`);
    console.log(`   - Slug: ${targetTenant.slug}`);
    console.log(`   - ID: ${targetTenant.id}`);
    console.log(`==================================================\n`);

    // 🧹 ล้างข้อมูล RAG เก่าทั้งหมดของ Tenant นี้ออกก่อน เพื่อเริ่มต้นทำข้อมูลที่สะอาดใหม่
    const deleteResult = await prisma.knowledgeArticle.deleteMany({
      where: {
        tenantId: TENANT_ID
      }
    });
    console.log(`🧹 เคลียร์บทความ RAG เก่าที่มั่วชื่อสำเร็จ: ${deleteResult.count} รายการ\n`);

    // 2. ตรวจเช็คไฟล์ข้อมูลเป้าหมาย
    let jsonPath = path.join(__dirname, '..', 'final_rag_data.json');
    if (!fs.existsSync(jsonPath)) {
      jsonPath = path.join(__dirname, '..', 'cleaned_rag_data.json');
    }
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ ไม่พบไฟล์ข้อมูลเป้าหมายทั้ง final_rag_data.json และ cleaned_rag_data.json ที่โฟลเดอร์หลักของโปรเจกต์`);
      return;
    }

    console.log(`🔍 กำลังอ่านไฟล์ข้อมูลจาก: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const qaPairs = JSON.parse(rawData);
    
    console.log(`🚀 กำลังเริ่มนำเข้าข้อมูล RAG สะอาดเข้าสู่ฐานข้อมูล... จำนวนทั้งหมด: ${qaPairs.length} รายการ`);

    let importedCount = 0;
    
    // ค่อยๆ เพิ่มลงฐานข้อมูลทีละรายการ
    for (const pair of qaPairs) {
      const q = pair.cleaned_question;
      const a = pair.cleaned_answer;
      
      if (!q || !a) continue;

      // ดึงคีย์เวิร์ดที่จับกลุ่มมาทั้งหมด หรือใช้หัวข้อคำถามหากไม่มีคีย์เวิร์ดกลุ่ม
      const keywords = Array.isArray(pair.keywords) && pair.keywords.length > 0 
        ? pair.keywords 
        : [q];

      // เพิ่มข้อมูลลงในตาราง KnowledgeArticle
      await prisma.knowledgeArticle.create({
        data: {
          tenantId: TENANT_ID,
          lineChannelId: null,
          title: q.substring(0, 100),
          content: a,
          keywords: keywords,
          isActive: true
        }
      });
      importedCount++;
      
      if (importedCount % 500 === 0) {
        console.log(`⏳ นำเข้าไปแล้ว: ${importedCount}/${qaPairs.length} รายการ...`);
      }
    }

    console.log(`\n🎉 นำเข้าข้อมูล RAG สะอาดใหม่สำเร็จเรียบร้อยทั้งหมด: ${importedCount} รายการ!`);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในขณะบันทึกข้อมูล:", error);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
