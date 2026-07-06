import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { StorageService } from "../storage/storage.service";
import { GeminiClient } from "../common/llm/gemini.client";
import { RealtimeService } from "../realtime/realtime.service";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "../redis/redis.service";
import { SlipOkClient } from "./slipok.client";
import { calculateSlipScore } from "./slip-score.util";
import { decodeSlipQr } from "./slip-qr-decode.util";
import { PutObjectCommand } from "@aws-sdk/client-s3";

@Injectable()
export class SlipService {
  private readonly logger = new Logger(SlipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService,
    private readonly storageService: StorageService,
    private readonly geminiClient: GeminiClient,
    private readonly realtimeService: RealtimeService,
    private readonly slipOkClient: SlipOkClient,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  private async ensureTagExistsAndLink(
    tenantId: string,
    conversationId: string,
    tagName: string,
    color: string
  ): Promise<void> {
    let tag = await this.prisma.conversationTag.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: tagName,
        },
      },
    });
    if (!tag) {
      tag = await this.prisma.conversationTag.create({
        data: {
          tenantId,
          name: tagName,
          color,
        },
      });
    }

    const existingLink = await this.prisma.conversationTagLink.findFirst({
      where: {
        tenantId,
        conversationId,
        tagId: tag.id,
      },
    });
    if (!existingLink) {
      await this.prisma.conversationTagLink.create({
        data: {
          tenantId,
          conversationId,
          tagId: tag.id,
        },
      });
    } else if (existingLink.deletedAt !== null) {
      await this.prisma.conversationTagLink.update({
        where: { id: existingLink.id },
        data: { deletedAt: null },
      });
    }
  }

  async processImageAsync(
    tenantId: string,
    conversationId: string,
    messageId: string,
    imageUrl?: string
  ): Promise<void> {
    this.logger.log(
      `Starting E2E slip verification for tenantId=${tenantId}, conversationId=${conversationId}, messageId=${messageId}, imageUrl=${imageUrl}`
    );

    try {
      // 1. Download image buffer
      let buffer: Buffer;
      let mimeType = "image/jpeg";

      if (imageUrl && !imageUrl.startsWith("line://") && !imageUrl.includes("api-data.line.me")) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get("content-type") || "image/jpeg";
      } else {
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { lineChannel: true },
        });
        if (!conversation || !conversation.lineChannel) {
          throw new Error(`Conversation ${conversationId} or its LINE channel not found`);
        }
        const encryptedToken = conversation.lineChannel.encryptedChannelAccessToken;
        const token = this.cryptoSecret.decrypt(encryptedToken);

        const response = await fetch(
          `https://api-data.line.me/v2/bot/message/${messageId}/content`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to download LINE media: ${response.statusText}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get("content-type") || "image/jpeg";
      }

      // 2. Upload to Cloudflare R2
      const r2Key = `slip/${tenantId}/${conversationId}/${messageId}.jpg`;
      await this.storageService["s3Client"].send(
        new PutObjectCommand({
          Bucket: this.storageService["bucket"],
          Key: r2Key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      this.logger.log(`Successfully uploaded slip image to R2: ${r2Key}`);

      // 3. QR code decode attempt (Pre-Filter)
      let qrResult: { status: "SUCCESS" | "FAILED" | "NOT_FOUND"; rawData?: string } = { status: "NOT_FOUND" };
      try {
        const decoded = await decodeSlipQr(buffer);
        qrResult = { status: decoded.status, rawData: decoded.rawData };
        this.logger.log(`QR pre-filter decode status: ${qrResult.status}`);
      } catch (qrErr) {
        this.logger.error(`QR pre-filter error: ${qrErr instanceof Error ? qrErr.message : qrErr}`);
      }

      // 4. Redis Quota Guard & SlipOK Verification
      let verifyProvider: string | null = null;
      let verifyPayload: any = null;
      let slipokCostCharged = false;
      let verifyStatus = "PENDING";

      if (qrResult.status === "SUCCESS" && qrResult.rawData) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const quotaKey = `slipok:quota:${tenantId}:${year}-${month}`;
        const limit = this.configService.get<number>("SLIPOK_MONTHLY_LIMIT") || 100;

        let count = 0;
        try {
          const countStr = await this.redisService.client.get(quotaKey);
          count = countStr ? parseInt(countStr, 10) : 0;
        } catch (redisErr) {
          this.logger.error(`Failed to retrieve quota count from Redis: ${redisErr}`);
        }

        if (count >= limit) {
          this.logger.warn(
            `Tenant ${tenantId} exceeded SlipOK monthly limit of ${limit}. Falling back to MANUAL_REVIEW.`
          );
          verifyStatus = "MANUAL_REVIEW";
        } else {
          try {
            verifyProvider = "SLIPOK";
            const response = await this.slipOkClient.verifyQr(qrResult.rawData);
            verifyPayload = response;

            if (response.status === "valid") {
              verifyStatus = "VERIFIED";
              slipokCostCharged = true;
            } else if (response.status === "duplicate") {
              verifyStatus = "DUPLICATE";
              slipokCostCharged = true;
            } else if (response.status === "invalid") {
              verifyStatus = "INVALID";
              slipokCostCharged = true;
            } else {
              verifyStatus = "MANUAL_REVIEW";
            }

            if (slipokCostCharged) {
              try {
                await this.redisService.client.incr(quotaKey);
                await this.redisService.client.expire(quotaKey, 35 * 24 * 60 * 60);
              } catch (redisErr) {
                this.logger.error(`Failed to increment Redis quota: ${redisErr}`);
              }
            }
          } catch (verifyErr) {
            this.logger.error(`SlipOK API error: ${verifyErr}`);
            verifyStatus = "MANUAL_REVIEW";
          }
        }
      }

      const systemPrompt = `
You are an expert OCR engine specializing in Thai bank transfer slips.
Analyze the provided slip image and extract the transaction details with absolute precision.
Pay extreme attention to distinguishing similar Thai characters:
- 'พ' (Ph) vs 'ภ' (Bh/Ph) - e.g., 'พุฒิเมธ' vs 'ภูมิเมธ'
- 'น' (N) vs 'ม' (M)
- 'ต' (T) vs 'ด' (D)
- 'บ' (B) vs 'ป' (P)

Return ONLY a valid JSON object matching this structure, with no markdown formatting and no extra text:
{
  "bankName": "Bank name or abbreviation (e.g. KBANK, SCB, KTB, BBL, TTB, BAY, GSB)",
  "amount": 123.45,
  "transactionRef": "Transaction reference code/number",
  "transferDate": "Date and time of transfer (e.g. YYYY-MM-DD HH:mm or DD/MM/YYYY HH:mm)",
  "promptpay": true,
  "rawText": "ALL recognized text lines from the image concatenated here, verbatim"
}
`;

      let ocrText = "";
      let bankName: string | undefined;
      let amount: number | undefined;
      let transactionRef: string | undefined;
      let transferDate: string | undefined;
      let isPromptPay = false;

      try {
        ocrText = await this.geminiClient.analyzeImage({
          systemPrompt,
          imageBuffer: buffer,
          mimeType,
        });
        this.logger.log(`Gemini Vision raw OCR output: ${ocrText}`);

        const parsed = JSON.parse(ocrText.replace(/```json|```/g, "").trim());
        bankName = parsed.bankName || undefined;
        if (typeof parsed.amount === "number") {
          amount = parsed.amount;
        } else if (parsed.amount) {
          amount = parseFloat(String(parsed.amount).replace(/,/g, ""));
        }
        transactionRef = parsed.transactionRef || undefined;
        transferDate = parsed.transferDate || undefined;
        isPromptPay = !!parsed.promptpay;
        ocrText = parsed.rawText || ocrText;
      } catch (ocrErr) {
        this.logger.error(
          `OCR JSON parsing failed: ${ocrErr instanceof Error ? ocrErr.message : ocrErr}`
        );
      }

      // 6. Calculate Slip Match Score with QR Result
      const scoreResult = calculateSlipScore(ocrText, qrResult);
      const slipScore = scoreResult.score;

      let parsedDate: Date | null = null;
      if (transferDate) {
        const d = Date.parse(transferDate);
        if (!isNaN(d)) parsedDate = new Date(d);
      }
      if (!parsedDate && scoreResult.transferDate) {
        const d = Date.parse(scoreResult.transferDate);
        if (!isNaN(d)) parsedDate = new Date(d);
      }

      // 7. Save SlipVerification record to database
      const slipVerification = await this.prisma.slipVerification.create({
        data: {
          tenantId,
          conversationId,
          messageId,
          r2ImageKey: r2Key,
          ocrText,
          bankName: bankName || scoreResult.bankName || null,
          amount: amount || scoreResult.amount || null,
          transactionRef: transactionRef || scoreResult.transactionRef || null,
          transferDate: parsedDate,
          slipScore,
          detectStatus: "DETECTED",
          verifyStatus,
          intent: isPromptPay ? "PROMPTPAY" : "BANK_TRANSFER",
          qrDecodedRaw: qrResult.rawData || null,
          qrDecodeStatus: qrResult.status,
          verifyProvider,
          verifyPayload: verifyPayload || null,
          slipokCostCharged,
        },
      });
      this.logger.log(`Created SlipVerification record: ${slipVerification.id}`);

      // 8. Auto-tagging and internal note creation
      // Calculate OCR baseline score to check if the image has slip characteristics
      const ocrScore = calculateSlipScore(ocrText).score;

      if (ocrScore >= 60) {
        // Tag "สลิป-รอตรวจสอบ" is always attached
        await this.ensureTagExistsAndLink(tenantId, conversationId, "สลิป-รอตรวจสอบ", "#FF9900");

        // Check if slip is suspicious
        const isSuspicious =
          qrResult.status === "NOT_FOUND" ||
          qrResult.status === "FAILED" ||
          verifyStatus === "INVALID" ||
          verifyStatus === "DUPLICATE" ||
          verifyStatus === "MANUAL_REVIEW";

        if (isSuspicious) {
          await this.ensureTagExistsAndLink(tenantId, conversationId, "สลิป-น่าสงสัย-QR", "#FF3333");
        }

        // Prepare Internal Note text
        const finalAmount = amount || scoreResult.amount;
        const amountStr = finalAmount !== undefined ? finalAmount.toFixed(2) : "ไม่ระบุ";

        let qrDetailStr = "ไม่ได้เรียกตรวจสอบ (ข้ามการแสกน)";
        if (qrResult.status === "FAILED") {
          qrDetailStr = "ระบบตรวจพบสลิปต้องสงสัย (QR Code เสียหายหรือถอดรหัสไม่ได้)";
        } else if (qrResult.status === "NOT_FOUND") {
          qrDetailStr = "ไม่พบ QR Code บนภาพสลิป";
        } else if (verifyStatus === "VERIFIED") {
          qrDetailStr = "การทวนสอบสำเร็จ ยอดเงินถูกต้อง";
        } else if (verifyStatus === "DUPLICATE") {
          qrDetailStr = "สลิปซ้ำซ้อน (สลิปนี้เคยใช้ยืนยันไปแล้ว)";
        } else if (verifyStatus === "INVALID") {
          qrDetailStr = "สลิปไม่ถูกต้อง (ข้อมูลไม่ตรงกับธนาคารหรือสลิปปลอม)";
        } else if (verifyStatus === "MANUAL_REVIEW") {
          qrDetailStr = "ระบบขัดข้องหรือโควตาหมด กรุณาตรวจสอบด้วยตนเอง";
        }

        const noteBody = `[System: Slip Verification]
ตรวจพบรูปภาพสลิปการโอนเงิน (คะแนนความมั่นใจ: ${slipScore}%)
• ธนาคาร: ${bankName || scoreResult.bankName || "ไม่ระบุ"}
• ยอดโอน: ${amountStr} บาท
• เลขที่อ้างอิง: ${transactionRef || scoreResult.transactionRef || "ไม่ระบุ"}
• วันที่โอน: ${transferDate || scoreResult.transferDate || "ไม่ระบุ"}

[ผลการทวนสอบสลิป (QR & SlipOK)]
• สถานะ QR: ${qrResult.status}
• ผู้ให้บริการ: ${verifyProvider || "-"}
• สถานะการทวนสอบ: ${verifyStatus}
• รายละเอียด: ${qrDetailStr}`;

        const firstMember = await this.prisma.workspaceMember.findFirst({
          where: { tenantId },
        });
        if (!firstMember) {
          throw new Error(`No workspace member found for tenant ${tenantId}`);
        }

        await this.prisma.conversationInternalNote.create({
          data: {
            tenantId,
            conversationId,
            authorMemberId: firstMember.id,
            body: noteBody.trim(),
          },
        });

        // Publish realtime event to trigger frontend updates
        await this.realtimeService.publishTenantEvent(tenantId, "conversation.updated", {
          conversationId,
        });
        this.logger.log(`Successfully auto-tagged and auto-noted conversation ${conversationId}`);
      }
    } catch (err) {
      this.logger.error(
        `Error in processImageAsync: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined
      );
      throw err;
    }
  }
}
