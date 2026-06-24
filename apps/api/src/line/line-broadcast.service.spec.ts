import { ConflictException, NotFoundException } from "@nestjs/common";
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
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
    updateMany: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [unknown]>;
};

const createPrisma = (): MockPrisma => {
  const prisma: MockPrisma = {
    lineChannel: {
      findFirst: jest.fn<Promise<unknown>, [unknown]>()
    },
    broadcastJob: {
      create: jest.fn<Promise<unknown>, [unknown]>(),
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
      updateMany: jest.fn<Promise<unknown>, [unknown]>(),
      findMany: jest.fn<Promise<unknown>, [unknown]>()
    },
    auditLog: {
      create: jest.fn<Promise<unknown>, [unknown]>()
    },
    $transaction: jest.fn<Promise<unknown>, [unknown]>()
  };

  prisma.$transaction.mockImplementation(async (callback: unknown) =>
    (callback as (tx: MockPrisma) => Promise<unknown>)(prisma)
  );

  return prisma;
};

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
    prisma.broadcastJob.updateMany.mockResolvedValue({ count: 1 });
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

    // Verify atomic claim before send
    expect(prisma.broadcastJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        status: BroadcastStatus.PENDING,
        deletedAt: null
      },
      data: { status: BroadcastStatus.PROCESSING }
    });

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

  it("skips broadcast execution when another worker already claimed the job", async () => {
    const prisma = createPrisma();
    prisma.broadcastJob.updateMany.mockResolvedValue({ count: 0 });

    global.fetch = jest.fn();
    const crypto = {
      decrypt: jest.fn(),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
    await service.executeBroadcastJob("job-1");

    expect(prisma.broadcastJob.findUnique).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe("deleteBroadcastJob", () => {
    const crypto = {
      decrypt: jest.fn(),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    it("soft-deletes a scheduled pending broadcast and logs cancellation audit", async () => {
      const prisma = createPrisma();
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      prisma.broadcastJob.findFirst.mockResolvedValue({
        id: "job-1",
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        status: BroadcastStatus.PENDING,
        scheduledAt: futureDate
      });
      prisma.broadcastJob.update.mockResolvedValue({ id: "job-1" });
      prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

      const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
      await service.deleteBroadcastJob("tenant-1", "line-channel-1", "job-1", "user-1");

      expect(prisma.broadcastJob.update).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { deletedAt: expect.any(Date) }
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          action: AuditAction.LINE_BROADCAST_CANCELLED,
          targetType: "BroadcastJob",
          targetId: "job-1"
        })
      });
    });

    it("soft-deletes a failed broadcast and logs deletion audit", async () => {
      const prisma = createPrisma();

      prisma.broadcastJob.findFirst.mockResolvedValue({
        id: "job-2",
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        status: BroadcastStatus.FAILED,
        scheduledAt: null
      });
      prisma.broadcastJob.update.mockResolvedValue({ id: "job-2" });
      prisma.auditLog.create.mockResolvedValue({ id: "audit-2" });

      const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
      await service.deleteBroadcastJob("tenant-1", "line-channel-1", "job-2", "user-1");

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.LINE_BROADCAST_DELETED,
          targetId: "job-2"
        })
      });
    });

    it("throws ConflictException for sent broadcasts", async () => {
      const prisma = createPrisma();
      prisma.broadcastJob.findFirst.mockResolvedValue({
        id: "job-3",
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        status: BroadcastStatus.SENT,
        scheduledAt: null
      });

      const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
      await expect(
        service.deleteBroadcastJob("tenant-1", "line-channel-1", "job-3", "user-1")
      ).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException for processing broadcasts", async () => {
      const prisma = createPrisma();
      prisma.broadcastJob.findFirst.mockResolvedValue({
        id: "job-4",
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        status: BroadcastStatus.PROCESSING,
        scheduledAt: null
      });

      const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
      await expect(
        service.deleteBroadcastJob("tenant-1", "line-channel-1", "job-4", "user-1")
      ).rejects.toThrow(ConflictException);
    });

    it("throws NotFoundException when job does not exist", async () => {
      const prisma = createPrisma();
      prisma.broadcastJob.findFirst.mockResolvedValue(null);

      const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
      await expect(
        service.deleteBroadcastJob("tenant-1", "line-channel-1", "missing", "user-1")
      ).rejects.toThrow(NotFoundException);
    });

    it("rolls back soft-delete when audit log creation fails", async () => {
      const prisma = createPrisma();
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      prisma.broadcastJob.findFirst.mockResolvedValue({
        id: "job-1",
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        status: BroadcastStatus.PENDING,
        scheduledAt: futureDate
      });
      prisma.broadcastJob.update.mockResolvedValue({ id: "job-1" });
      prisma.auditLog.create.mockRejectedValue(
        new Error('invalid input value for enum "AuditAction": "LINE_BROADCAST_CANCELLED"')
      );

      const service = new LineBroadcastService(prisma as unknown as PrismaService, crypto);
      await expect(
        service.deleteBroadcastJob("tenant-1", "line-channel-1", "job-1", "user-1")
      ).rejects.toThrow(/LINE_BROADCAST_CANCELLED/);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.broadcastJob.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
