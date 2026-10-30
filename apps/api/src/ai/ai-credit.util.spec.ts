import { PrismaService } from "../prisma/prisma.service";
import { runWithAiCredit } from "./ai-credit.util";

const createPrisma = (limit: number | null = 10) => {
  const prisma = {
    planLimit: {
      findUnique: jest
        .fn()
        .mockResolvedValue(limit === null ? null : { maxAiCreditsPerMonth: limit })
    },
    usageCounter: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    }
  };
  return { prisma, service: prisma as unknown as PrismaService };
};

describe("runWithAiCredit", () => {
  it("reserves with a conditional increment and keeps a consumed credit", async () => {
    const { prisma, service } = createPrisma(10);

    const result = await runWithAiCredit(
      service,
      "tenant-1",
      "plan-1",
      async (credit) => {
        credit.consume();
        return "ran";
      },
      async () => "unavailable"
    );

    expect(result).toBe("ran");
    expect(prisma.usageCounter.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.usageCounter.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: "tenant-1", value: { lt: 10 } }),
      data: { value: { increment: 1 } }
    });
  });

  it("does not run when another request took the last credit", async () => {
    const { prisma, service } = createPrisma();
    prisma.usageCounter.updateMany.mockResolvedValue({ count: 0 });
    const run = jest.fn();

    await expect(
      runWithAiCredit(service, "tenant-1", "plan-1", run, async () => "unavailable")
    ).resolves.toBe("unavailable");
    expect(run).not.toHaveBeenCalled();
  });

  it.each([[null], [0]])("does not reserve when the plan limit is %s", async (limit) => {
    const { prisma, service } = createPrisma(limit);
    const run = jest.fn();

    await expect(
      runWithAiCredit(service, "tenant-1", "plan-1", run, async () => "unavailable")
    ).resolves.toBe("unavailable");
    expect(prisma.usageCounter.updateMany).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("returns the credit when run ends without consuming it", async () => {
    const { prisma, service } = createPrisma();

    await runWithAiCredit(service, "tenant-1", "plan-1", async () => "skipped", async () => "no");

    expect(prisma.usageCounter.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ tenantId: "tenant-1", value: { gt: 0 } }),
      data: { value: { decrement: 1 } }
    });
  });

  it("returns the credit and rethrows when run fails", async () => {
    const { prisma, service } = createPrisma();

    await expect(
      runWithAiCredit(
        service,
        "tenant-1",
        "plan-1",
        async () => {
          throw new Error("llm down");
        },
        async () => "no"
      )
    ).rejects.toThrow("llm down");

    expect(prisma.usageCounter.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { value: { decrement: 1 } } })
    );
  });

  it("keeps the original result when returning the credit fails", async () => {
    const { prisma, service } = createPrisma();
    prisma.usageCounter.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("db down"));

    await expect(
      runWithAiCredit(service, "tenant-1", "plan-1", async () => "skipped", async () => "no")
    ).resolves.toBe("skipped");
  });
});
