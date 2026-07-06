-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN "enable_slip_auto_acknowledge" BOOLEAN DEFAULT false,
ADD COLUMN "slip_auto_acknowledge_message" TEXT DEFAULT 'ได้รับสลิปแล้วค่ะ กำลังตรวจสอบให้ รอสักครู่นะคะ 🙏',
ADD COLUMN "enable_slip_result_auto_reply" BOOLEAN DEFAULT false,
ADD COLUMN "slip_result_success_message" TEXT DEFAULT 'สลิปข้อมูลถูกต้อง',
ADD COLUMN "slip_result_failed_message" TEXT DEFAULT 'ข้อมูลไม่ถูกต้อง รบกวนตรวจสอบใหม่อีกครั้ง';

-- AlterTable
ALTER TABLE "slip_verifications" ADD COLUMN "verify_error_code" VARCHAR(50);
