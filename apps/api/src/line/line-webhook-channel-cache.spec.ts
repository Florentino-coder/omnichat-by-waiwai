import { NotFoundException } from "@nestjs/common";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { LineWebhookService } from "./line-webhook.service";

describe("LineWebhookService.getChannelSecret", () => {
  const createDeps = () => {
    const findUnique = jest.fn<Promise<unknown>, [unknown]>();
    const service = new LineWebhookService(
      { lineChannel: { findUnique } } as unknown as PrismaService,
      { decrypt: (value: string) => `decrypted:${value}` } as unknown as CryptoSecretService
    );
    return { findUnique, service };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not query the DB again for an unknown channel within the TTL", async () => {
    const { findUnique, service } = createDeps();
    findUnique.mockResolvedValue(null);

    await expect(service.getChannelSecret("unknown")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getChannelSecret("unknown")).rejects.toBeInstanceOf(NotFoundException);

    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("re-checks the DB after the TTL so new channels start working", async () => {
    const { findUnique, service } = createDeps();
    findUnique.mockResolvedValueOnce(null);
    await expect(service.getChannelSecret("new")).rejects.toBeInstanceOf(NotFoundException);

    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 60_001);
    findUnique.mockResolvedValueOnce({
      deletedAt: null,
      isActive: true,
      encryptedChannelSecret: "secret"
    });

    await expect(service.getChannelSecret("new")).resolves.toBe("decrypted:secret");
  });

  it("always reads active channels from the DB so a rotated secret applies immediately", async () => {
    const { findUnique, service } = createDeps();
    findUnique
      .mockResolvedValueOnce({ deletedAt: null, isActive: true, encryptedChannelSecret: "old" })
      .mockResolvedValueOnce({ deletedAt: null, isActive: true, encryptedChannelSecret: "new" });

    await expect(service.getChannelSecret("line-1")).resolves.toBe("decrypted:old");
    await expect(service.getChannelSecret("line-1")).resolves.toBe("decrypted:new");
  });

  it("rejects inactive channels", async () => {
    const { findUnique, service } = createDeps();
    findUnique.mockResolvedValue({ deletedAt: null, isActive: false, encryptedChannelSecret: "x" });

    await expect(service.getChannelSecret("line-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
