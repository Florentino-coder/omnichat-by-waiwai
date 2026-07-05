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

  beforeEach(async () => {
    prisma = {
      conversation: {
        findUnique: jest.fn(),
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
      },
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === "SLIPOK_MONTHLY_LIMIT") return 100;
        return null;
      }),
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

    expect(prisma.conversationInternalNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: expect.stringContaining("สถานะ QR: NOT_FOUND"),
      }),
    });
  });

  it("Scenario 2: QR decode failed - should score 0, mark as suspicious and auto-tag both tags", async () => {
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

    // Check that score was reduced to 0 in database create call
    expect(prisma.slipVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slipScore: 0,
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
});
