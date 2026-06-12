import { AuditAction } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { LineChannelsService } from "./line-channels.service";

type MockPrisma = {
  lineChannel: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  lineChannel: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const cryptoSecret = {
  encrypt: jest.fn((value: string) => `encrypted:${value}`),
  decrypt: jest.fn()
} as unknown as CryptoSecretService;

describe("LineChannelsService", () => {
  it("stores encrypted LINE secrets under the current tenant", async () => {
    const prisma = createPrisma();
    prisma.lineChannel.create.mockResolvedValue({ id: "line-channel-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await new LineChannelsService(
      prisma as unknown as PrismaService,
      cryptoSecret
    ).connect("tenant-1", "user-1", {
      workspaceId: "workspace-1",
      name: "Main LINE",
      lineChannelId: "1650000000",
      channelSecret: "plain-secret",
      channelAccessToken: "plain-token"
    });

    expect(prisma.lineChannel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        encryptedChannelSecret: "encrypted:plain-secret",
        encryptedChannelAccessToken: "encrypted:plain-token"
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LINE_CHANNEL_CONNECTED,
        targetType: "LineChannel"
      })
    });
  });
});

