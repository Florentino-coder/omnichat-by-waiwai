import { AuditAction, BroadcastStatus, BroadcastType } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { LineBroadcastService } from "./line-broadcast.service";

type MockPrisma = {
  lineChannel: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  broadcastJob: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  lineChannel: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  broadcastJob: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

describe("LineBroadcastService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("creates a broadcast job and executes it immediately when no scheduled date is specified", async () => {
    const prisma = createPrisma();
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.broadcastJob.create.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      createdByUserId: "user-1",
      type: BroadcastType.BROADCAST,
      status: BroadcastStatus.PENDING,
      messages: [{ type: "text", text: "Hello Broadcast" }],
      scheduledAt: null
    });
    prisma.broadcastJob.findUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      createdByUserId: "user-1",
      type: BroadcastType.BROADCAST,
      status: BroadcastStatus.PENDING,
      messages: [{ type: "text", text: "Hello Broadcast" }],
      scheduledAt: null,
      lineChannel: {
        id: "line-channel-1",
        encryptedChannelAccessToken: "encrypted-token"
      }
    });
    prisma.broadcastJob.update.mockResolvedValue({ id: "job-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("")
    }) as unknown as typeof fetch;

    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
    await service.createBroadcast("tenant-1", "user-1", "line-channel-1", {
      text: "Hello Broadcast"
    });

    // Verify it saved the schedule audit
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LINE_BROADCAST_SCHEDULED,
        targetType: "BroadcastJob"
      })
    });

    // Verify fetch broadcast endpoint was called
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/broadcast",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer channel-token"
        })
      })
    );

    // Verify it updated job status to sent and logged the sent audit
    expect(prisma.broadcastJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: BroadcastStatus.SENT
      })
    });
  });

  it("only schedules a broadcast job when scheduledAt is in the future", async () => {
    const prisma = createPrisma();
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      encryptedChannelAccessToken: "encrypted-token"
    });

    const futureDate = new Date();
    futureDate.setMinutes(futureDate.getMinutes() + 15);

    prisma.broadcastJob.create.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      createdByUserId: "user-1",
      type: BroadcastType.BROADCAST,
      status: BroadcastStatus.PENDING,
      messages: [{ type: "text", text: "Hello Scheduled" }],
      scheduledAt: futureDate
    });
    prisma.broadcastJob.findUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      createdByUserId: "user-1",
      type: BroadcastType.BROADCAST,
      status: BroadcastStatus.PENDING,
      messages: [{ type: "text", text: "Hello Scheduled" }],
      scheduledAt: futureDate
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    global.fetch = jest.fn();
    const crypto = {
      decrypt: jest.fn(),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
    await service.createBroadcast("tenant-1", "user-1", "line-channel-1", {
      text: "Hello Scheduled",
      scheduledAt: futureDate.toISOString()
    });

    // Verify scheduled audit log is created
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        action: AuditAction.LINE_BROADCAST_SCHEDULED
      })
    });

    // Verify LINE API fetch was NOT called since it's scheduled for the future
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
