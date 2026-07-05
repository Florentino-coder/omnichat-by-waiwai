import { calculateSlipScore } from "./slip-score.util";

describe("calculateSlipScore", () => {
  it("Case 1: Real slip example 1 (KBank) - high score", () => {
    const ocrText = `
      โอนเงินสำเร็จ
      ธนาคารกสิกรไทย (KBANK)
      วันที่ 05 ก.ค. 2569 เวลา 12:30 น.
      จำนวนเงิน 1,500.00 บาท
      เลขที่อ้างอิง: ref: 1234567890AB
      พร้อมเพย์
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(100); // 20 + 20 + 20 + 30 + 10
    expect(result.matchedFields).toContain("bankName");
    expect(result.matchedFields).toContain("amount");
    expect(result.matchedFields).toContain("dateTime");
    expect(result.matchedFields).toContain("reference");
    expect(result.matchedFields).toContain("promptpay");
    expect(result.bankName).toMatch(/กสิกร|KBANK/i);
    expect(result.amount).toBe(1500);
    expect(result.transactionRef).toBe("1234567890AB");
  });

  it("Case 2: Real slip example 2 (SCB) - high score", () => {
    const ocrText = `
      ไทยพาณิชย์ SCB
      โอนเงินให้ สมชาย ใจดี
      ยอดเงิน: ฿350.00
      วันที่: 05-07-2026 14:15
      เลขที่รายการ: 20260705SCB9876
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(90); // 20 + 20 + 20 + 30
    expect(result.matchedFields).toContain("bankName");
    expect(result.matchedFields).toContain("amount");
    expect(result.matchedFields).toContain("dateTime");
    expect(result.matchedFields).toContain("reference");
    expect(result.bankName).toMatch(/ไทยพาณิชย์|SCB/i);
    expect(result.amount).toBe(350);
    expect(result.transactionRef).toBe("20260705SCB9876");
  });

  it("Case 3: Real slip example 3 (BBL PromptPay) - high score", () => {
    const ocrText = `
      ธนาคารกรุงเทพ BBL
      โอนเงินสำเร็จผ่าน promptpay
      จำนวนเงิน 99.00 THB
      วันที่ 05/07/2026
      Ref. 9988776655
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(100); // 20 + 20 + 20 + 30 + 10
    expect(result.matchedFields).toContain("promptpay");
    expect(result.amount).toBe(99);
    expect(result.transactionRef).toBe("9988776655");
  });

  it("Case 4: Empty text - score 0", () => {
    const result = calculateSlipScore("");
    expect(result.score).toBe(0);
    expect(result.matchedFields).toEqual([]);
  });

  it("Case 5: Screenshot of a news article - low score", () => {
    const ocrText = `
      พายุทอร์นาโดถล่มสหรัฐอเมริกา เสียหายกว่าสิบล้านเหรียญ
      ประชาชนอพยพด่วนหลังจากประกาศเตือนภัยจากรัฐบาล
      สำนักข่าวไทยรายงานวันที่ 5 กรกฎาคม
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(0);
    expect(result.matchedFields).toEqual([]);
  });

  it("Case 6: Standard retail receipt (no bank details, no reference) - low-medium score", () => {
    const ocrText = `
      เซเว่น อีเลฟเว่น สาขา 1234
      ไส้กรอก 1 ชิ้น: 29.00 บาท
      น้ำดื่ม 1 ขวด: 10.00 บาท
      ราคารวมทั้งสิ้น 39.00 บาท
      วันที่ 05/07/2026 18:00
      ขอบคุณที่ใช้บริการ
    `;
    const result = calculateSlipScore(ocrText);
    // Matches: amount (บาท), dateTime (05/07/2026 18:00)
    expect(result.score).toBe(40);
    expect(result.matchedFields).toContain("amount");
    expect(result.matchedFields).toContain("dateTime");
    expect(result.matchedFields).not.toContain("bankName");
    expect(result.matchedFields).not.toContain("reference");
  });

  it("Case 7: Only amount and date - medium score", () => {
    const ocrText = `
      ยอดเงิน 500 บาท
      วันที่ 05/07/2026
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(40);
    expect(result.matchedFields).toContain("amount");
    expect(result.matchedFields).toContain("dateTime");
  });

  it("Case 8: Only reference number - medium score", () => {
    const ocrText = `
      รหัสอ้างอิง: REF9988776655
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(30);
    expect(result.matchedFields).toContain("reference");
    expect(result.transactionRef).toBe("REF9988776655");
  });

  it("Case 9: Only bank name - medium score", () => {
    const ocrText = `
      โอนเข้าบัญชีธนาคารกรุงไทย KTB
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(20);
    expect(result.matchedFields).toContain("bankName");
    expect(result.bankName).toBe("กรุงไทย");
  });

  it("Case 10: Only promptpay keyword - low score", () => {
    const ocrText = `
      ชำระเงินผ่านระบบ พร้อมเพย์
    `;
    const result = calculateSlipScore(ocrText);
    expect(result.score).toBe(10);
    expect(result.matchedFields).toContain("promptpay");
  });

  it("Case 11: Valid OCR + successful QR decode -> score remains unchanged", () => {
    const ocrText = "โอนเข้าบัญชีธนาคารกรุงไทย KTB";
    const result = calculateSlipScore(ocrText, { status: "SUCCESS", rawData: "https://example.com" });
    expect(result.score).toBe(20);
  });

  it("Case 12: Valid OCR + failed/damaged QR decode -> score becomes 0", () => {
    const ocrText = "โอนเข้าบัญชีธนาคารกรุงไทย KTB";
    const result = calculateSlipScore(ocrText, { status: "FAILED" });
    expect(result.score).toBe(0);
  });

  it("Case 13: Valid OCR + QR not found -> score remains unchanged", () => {
    const ocrText = "โอนเข้าบัญชีธนาคารกรุงไทย KTB";
    const result = calculateSlipScore(ocrText, { status: "NOT_FOUND" });
    expect(result.score).toBe(20);
  });
});
