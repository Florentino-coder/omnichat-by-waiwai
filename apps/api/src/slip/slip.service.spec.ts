import { Test, TestingModule } from "@nestjs/testing";
import { SlipService } from "./slip.service";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { StorageService } from "../storage/storage.service";
import { GeminiClient } from "../common/llm/gemini.client";
import { RealtimeService } from "../realtime/realtime.service";
import { SlipOkClient } from "./slipok.client";
import { RedisService } from "../redis/redis.service";
import { ConfigService } from "@nestjs/config";
import { LineReplyService } from "../line/line-reply.service";
import { decodeSlipQr } from "./slip-qr-decode.util";

jest.mock("./slip-qr-decode.util", () => ({
  decodeSlipQr: jest.fn(),
}));

describe("SlipService", () => {
  let service: SlipService;
  let prisma: any;
  let cryptoSecret: any;
  let storageService: any;
  let geminiClient: any;
  let realtimeService: any;
  let slipOkClient: any;
  let redisService: any;
  let configService: any;
  let lineReplyService: any;

  beforeEach(async () => {
    prisma = {
      conversation: {
        findUnique: jest.fn(),
      },
      tenantSettings: {
        findUnique: jest.fn().mockResolvedValue({
          enableSlipAutoAcknowledge: false,
          slipAutoAcknowledgeMessage: "ได้รับสลิปแล้วค่ะ กำลังตรวจสอบให้ รอสักครู่นะคะ 🙏",
          enableSlipResultAutoReply: false,
          slipResultSuccessMessage: "สลิปข้อมูลถูกต้อง",
          slipResultFailedMessage: "ข้อมูลไม่ถูกต้อง รบกวนตรวจสอบใหม่อีกครั้ง",
        }),
      },
      slipVerification: {
        create: jest.fn(),
      },
      conversationTag: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      conversationTagLink: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationInternalNote: {
        create: jest.fn(),
      },
      workspaceMember: {
        findFirst: jest.fn(),
      },
    };
    cryptoSecret = {
      decrypt: jest.fn(),
    };
    storageService = {
      s3Client: {
        send: jest.fn(),
      },
      bucket: "test-bucket",
    };
    geminiClient = {
      analyzeImage: jest.fn(),
    };
    realtimeService = {
      publishTenantEvent: jest.fn(),
    };
    slipOkClient = {
      verifyQr: jest.fn(),
    };
    redisService = {
      client: {
        get: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        set: jest.fn(),
      },
      getClient: jest.fn(() => redisService.client),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === "SLIPOK_MONTHLY_LIMIT") return 100;
        return null;
      }),
    };
    lineReplyService = {
      replyText: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlipService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoSecretService, useValue: cryptoSecret },
        { provide: StorageService, useValue: storageService },
        { provide: GeminiClient, useValue: geminiClient },
        { provide: RealtimeService, useValue: realtimeService },
        { provide: SlipOkClient, useValue: slipOkClient },
        { provide: RedisService, useValue: redisService },
        { provide: ConfigService, useValue: configService },
        { provide: LineReplyService, useValue: lineReplyService },
      ],
    }).compile();

    service = module.get<SlipService>(SlipService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("Scenario 1: QR not found - should flag as suspicious and auto-tag both tags", async () => {
    (decodeSlipQr as jest.Mock).mockResolvedValue({ status: "NOT_FOUND" });
    const mockBuffer = Buffer.from("mock-image-data");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "image/jpeg",
      },
      arrayBuffer: () => Promise.resolve(mockBuffer),
    } as any);

    storageService.s3Client.send.mockResolvedValue({});
    geminiClient.analyzeImage.mockResolvedValue(
      JSON.stringify({
        bankName: "KBANK",
        amount: 1500,
        transactionRef: "1234567890AB",
        transferDate: "2026-07-05 12:30",
        promptpay: true,
        rawText: "กสิกร 1,500 บาท ref: 1234567890AB พร้อมเพย์",
      })
    );

    prisma.slipVerification.create.mockResolvedValue({ id: "slip-1" });
    prisma.conversationTag.findUnique.mockResolvedValue(null);
    prisma.conversationTag.create.mockResolvedValue({ id: "tag-1" });
    prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });

    await service.processImageAsync(
      "tenant-1",
      "conv-1",
      "msg-1",
      "https://example.com/slip.jpg"
    );

    // Verify tag creation for both tags
    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-รอตรวจสอบ", color: "#FF9900" },
    });
    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-น่าสงสัย-QR", color: "#FF3333" },
    });

    expect(prisma.conversationInternalNote.create).not.toHaveBeenCalled();
  });

  it("Scenario 2: QR decode failed - should NOT deduct score, mark as suspicious and auto-tag both tags", async () => {
    (decodeSlipQr as jest.Mock).mockResolvedValue({ status: "FAILED" });
    const mockBuffer = Buffer.from("mock-image-data");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "image/jpeg",
      },
      arrayBuffer: () => Promise.resolve(mockBuffer),
    } as any);

    storageService.s3Client.send.mockResolvedValue({});
    geminiClient.analyzeImage.mockResolvedValue(
      JSON.stringify({
        bankName: "KBANK",
        amount: 1500,
        transactionRef: "1234567890AB",
        transferDate: "2026-07-05 12:30",
        promptpay: true,
        rawText: "กสิกร 1,500 บาท ref: 1234567890AB พร้อมเพย์",
      })
    );

    prisma.slipVerification.create.mockResolvedValue({ id: "slip-2" });
    prisma.conversationTag.findUnique.mockResolvedValue(null);
    prisma.conversationTag.create.mockResolvedValue({ id: "tag-1" });
    prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });

    await service.processImageAsync(
      "tenant-1",
      "conv-1",
      "msg-1",
      "https://example.com/slip.jpg"
    );

    // Check that score was NOT reduced in database create call
    expect(prisma.slipVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slipScore: 80,
          qrDecodeStatus: "FAILED",
        }),
      })
    );

    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-รอตรวจสอบ", color: "#FF9900" },
    });
    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-น่าสงสัย-QR", color: "#FF3333" },
    });
  });

  it("Scenario 3: QR success & SlipOK VERIFIED - should only tag สลิป-รอตรวจสอบ", async () => {
    (decodeSlipQr as jest.Mock).mockResolvedValue({ status: "SUCCESS", rawData: "000201..." });
    redisService.client.get.mockResolvedValue("5"); // current count is 5 (limit is 100)
    slipOkClient.verifyQr.mockResolvedValue({ status: "valid", data: { amount: 1500 } });

    const mockBuffer = Buffer.from("mock-image-data");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "image/jpeg",
      },
      arrayBuffer: () => Promise.resolve(mockBuffer),
    } as any);

    storageService.s3Client.send.mockResolvedValue({});
    geminiClient.analyzeImage.mockResolvedValue(
      JSON.stringify({
        bankName: "KBANK",
        amount: 1500,
        transactionRef: "1234567890AB",
        transferDate: "2026-07-05 12:30",
        promptpay: true,
        rawText: "กสิกร 1,500 บาท ref: 1234567890AB พร้อมเพย์",
      })
    );

    prisma.slipVerification.create.mockResolvedValue({ id: "slip-3" });
    prisma.conversationTag.findUnique.mockResolvedValue(null);
    prisma.conversationTag.create.mockResolvedValue({ id: "tag-1" });
    prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });

    await service.processImageAsync(
      "tenant-1",
      "conv-1",
      "msg-1",
      "https://example.com/slip.jpg"
    );

    // Verify database record has VERIFIED status and cost charged
    expect(prisma.slipVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verifyStatus: "VERIFIED",
          slipokCostCharged: true,
        }),
      })
    );

    // Increment quota in Redis
    expect(redisService.client.incr).toHaveBeenCalled();

    // Only tag "สลิป-รอตรวจสอบ" should be created, NOT the suspicious tag
    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-รอตรวจสอบ", color: "#FF9900" },
    });
    expect(prisma.conversationTag.create).not.toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-น่าสงสัย-QR", color: "#FF3333" },
    });
  });

  it("Scenario 4: QR success but Redis Quota Exceeded - should fallback to MANUAL_REVIEW and tag suspicious", async () => {
    (decodeSlipQr as jest.Mock).mockResolvedValue({ status: "SUCCESS", rawData: "000201..." });
    redisService.client.get.mockResolvedValue("100"); // current count is 100 (limit is 100)

    const mockBuffer = Buffer.from("mock-image-data");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "image/jpeg",
      },
      arrayBuffer: () => Promise.resolve(mockBuffer),
    } as any);

    storageService.s3Client.send.mockResolvedValue({});
    geminiClient.analyzeImage.mockResolvedValue(
      JSON.stringify({
        bankName: "KBANK",
        amount: 1500,
        transactionRef: "1234567890AB",
        transferDate: "2026-07-05 12:30",
        promptpay: true,
        rawText: "กสิกร 1,500 บาท ref: 1234567890AB พร้อมเพย์",
      })
    );

    prisma.slipVerification.create.mockResolvedValue({ id: "slip-4" });
    prisma.conversationTag.findUnique.mockResolvedValue(null);
    prisma.conversationTag.create.mockResolvedValue({ id: "tag-1" });
    prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });

    await service.processImageAsync(
      "tenant-1",
      "conv-1",
      "msg-1",
      "https://example.com/slip.jpg"
    );

    // Verify status is MANUAL_REVIEW and SlipOK Client was NOT called
    expect(slipOkClient.verifyQr).not.toHaveBeenCalled();
    expect(prisma.slipVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verifyStatus: "MANUAL_REVIEW",
          slipokCostCharged: false,
        }),
      })
    );

    // Tags both tags since MANUAL_REVIEW is suspicious
    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-รอตรวจสอบ", color: "#FF9900" },
    });
    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", name: "สลิป-น่าสงสัย-QR", color: "#FF3333" },
    });
  });

  describe("Phase 3: Auto-Replies and Error Codes", () => {
    beforeEach(() => {
      (decodeSlipQr as jest.Mock).mockResolvedValue({ status: "SUCCESS", rawData: "000201..." });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: () => Promise.resolve(Buffer.from("mock-image-data")),
      } as any);

      geminiClient.analyzeImage.mockResolvedValue(
        JSON.stringify({
          bankName: "KBANK",
          amount: 1500,
          transactionRef: "1234567890AB",
          transferDate: "2026-07-05 12:00:00",
          promptpay: false,
          rawText: "กสิกร โอนเงินสำเร็จ จํานวนเงิน 1500 บาท 06/07/2026 12:00 ref: 1234567890AB"
        })
      );
      storageService.s3Client.send.mockResolvedValue({});
      prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });
      prisma.slipVerification.create.mockResolvedValue({ id: "slip-test" });
      prisma.conversationTag.findUnique.mockResolvedValue(null);
      prisma.conversationTag.create.mockResolvedValue({ id: "tag-1" });
      prisma.conversationTagLink.findFirst.mockResolvedValue(null);
      prisma.conversationTagLink.create.mockResolvedValue({ id: "link-1" });
    });

    it("should send Safe Auto-Acknowledge when enabled and score >= 60, but respect Redis cooldown", async () => {
      prisma.tenantSettings.findUnique.mockResolvedValue({
        enableSlipAutoAcknowledge: true,
        slipAutoAcknowledgeMessage: "ได้รับสลิปแล้วค่ะ กำลังตรวจสอบให้ รอสักครู่นะคะ 🙏",
        enableSlipResultAutoReply: false,
      });

      // 1. First call: cooldown key is not set
      redisService.client.get.mockResolvedValue(null);

      await service.processImageAsync("tenant-1", "conv-1", "msg-1", "https://example.com/slip.jpg");

      expect(lineReplyService.replyText).toHaveBeenCalledWith(
        "tenant-1",
        "system",
        "conv-1",
        { text: "ได้รับสลิปแล้วค่ะ กำลังตรวจสอบให้ รอสักครู่นะคะ 🙏" }
      );
      expect(redisService.client.set).toHaveBeenCalledWith(
        "slip-ack-cooldown:conv-1",
        "true",
        "EX",
        10
      );

      // Reset mocks for second call
      lineReplyService.replyText.mockClear();

      // 2. Second call: cooldown key is set
      redisService.client.get.mockResolvedValue("true");

      await service.processImageAsync("tenant-1", "conv-1", "msg-1", "https://example.com/slip.jpg");

      expect(lineReplyService.replyText).not.toHaveBeenCalled();
    });

    it("should send success auto-reply when enableSlipResultAutoReply is true and verifyStatus is VERIFIED", async () => {
      prisma.tenantSettings.findUnique.mockResolvedValue({
        enableSlipAutoAcknowledge: false,
        enableSlipResultAutoReply: true,
        slipResultSuccessMessage: "สลิปข้อมูลถูกต้องจ้า",
        slipResultFailedMessage: "ข้อมูลไม่ถูกต้องนะ",
      });
      slipOkClient.verifyQr.mockResolvedValue({ status: "valid" });

      await service.processImageAsync("tenant-1", "conv-1", "msg-1", "https://example.com/slip.jpg");

      expect(lineReplyService.replyText).toHaveBeenCalledWith(
        "tenant-1",
        "system",
        "conv-1",
        { text: "สลิปข้อมูลถูกต้องจ้า" }
      );
      // No verifyErrorCode since it's VERIFIED
      expect(prisma.slipVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifyStatus: "VERIFIED",
            verifyErrorCode: null,
          }),
        })
      );
    });

    it("should send failed auto-reply and save error1 when verifyStatus is INVALID", async () => {
      prisma.tenantSettings.findUnique.mockResolvedValue({
        enableSlipAutoAcknowledge: false,
        enableSlipResultAutoReply: true,
        slipResultSuccessMessage: "สลิปข้อมูลถูกต้องจ้า",
        slipResultFailedMessage: "ข้อมูลไม่ถูกต้องนะ",
      });
      slipOkClient.verifyQr.mockResolvedValue({ status: "invalid" });

      await service.processImageAsync("tenant-1", "conv-1", "msg-1", "https://example.com/slip.jpg");

      expect(lineReplyService.replyText).toHaveBeenCalledWith(
        "tenant-1",
        "system",
        "conv-1",
        { text: "ข้อมูลไม่ถูกต้องนะ" }
      );
      // verifyErrorCode must be error1 (customer does not see this in replyText!)
      expect(prisma.slipVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifyStatus: "INVALID",
            verifyErrorCode: "error1",
          }),
        })
      );
    });
  });
});
