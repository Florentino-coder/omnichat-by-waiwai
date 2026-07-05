export interface SlipScoreResult {
  score: number;
  matchedFields: string[];
  bankName?: string;
  amount?: number;
  transactionRef?: string;
  transferDate?: string;
}

const SCORE_RULES = [
  { key: "bankName",   weight: 20, pattern: /กสิกร|กรุงเทพ|ไทยพาณิชย์|กรุงไทย|ออมสิน|ทหารไทย|KBANK|KTB|SCB|BBL|TTB|BAY|UOB/i },
  { key: "amount",     weight: 20, pattern: /฿\s*[\d,]+(?:\.\d{2})?|[\d,]+\s*(?:บาท|THB)/i },
  { key: "dateTime",   weight: 20, pattern: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{2}:\d{2}/ },
  { key: "reference",  weight: 30, pattern: /ref\.?\s*:?\s*[\dA-Z]{8,}|รหัสอ้างอิง|transaction\s*id|เลขที่รายการ/i },
  { key: "promptpay",  weight: 10, pattern: /พร้อมเพย์|promptpay/i },
];

export function calculateSlipScore(
  ocrText: string,
  qrResult?: { status: "SUCCESS" | "FAILED" | "NOT_FOUND"; rawData?: string }
): SlipScoreResult {
  if (!ocrText) {
    return { score: 0, matchedFields: [] };
  }

  let score = 0;
  const matchedFields: string[] = [];

  for (const rule of SCORE_RULES) {
    if (rule.pattern.test(ocrText)) {
      score += rule.weight;
      matchedFields.push(rule.key);
    }
  }

  // Extract optional fields if matched
  let bankName: string | undefined;
  let amount: number | undefined;
  let transactionRef: string | undefined;
  let transferDate: string | undefined;

  if (matchedFields.includes("bankName")) {
    const m = ocrText.match(/กสิกร|กรุงเทพ|ไทยพาณิชย์|กรุงไทย|ออมสิน|ทหารไทย|KBANK|KTB|SCB|BBL|TTB|BAY|UOB/i);
    if (m) bankName = m[0];
  }

  if (matchedFields.includes("amount")) {
    const m = ocrText.match(/(?:฿\s*([\d,]+(?:\.\d{2})?))|((?:[\d,]+(?:\.\d{2})?))\s*(?:บาท|THB)/i);
    if (m) {
      const rawVal = m[1] || m[2];
      if (rawVal) {
        amount = parseFloat(rawVal.replace(/,/g, ""));
      }
    }
  }

  if (matchedFields.includes("dateTime")) {
    const d = ocrText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
    const t = ocrText.match(/\d{2}:\d{2}/);
    const parts: string[] = [];
    if (d) parts.push(d[0]);
    if (t) parts.push(t[0]);
    if (parts.length > 0) transferDate = parts.join(" ");
  }

  if (matchedFields.includes("reference")) {
    const m = ocrText.match(/(?:ref\.?\s*:?\s*|รหัสอ้างอิง\s*:?\s*|transaction\s*id\s*:?\s*|เลขที่รายการ\s*:?\s*)([\dA-Z]{8,})/i);
    if (m && m[1]) {
      transactionRef = m[1];
    } else {
      const m2 = ocrText.match(/ref\.?\s*:?\s*([\dA-Z]{8,})/i);
      if (m2 && m2[1]) transactionRef = m2[1];
    }
  }

  // Adjust score to 0 if QR code decode failed
  if (qrResult && qrResult.status === "FAILED") {
    score = 0;
  }

  return {
    score,
    matchedFields,
    bankName,
    amount,
    transactionRef,
    transferDate,
  };
}
