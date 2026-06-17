import { BroadcastStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LineBroadcastScheduler } from "./line-broadcast.scheduler";
import { LineBroadcastService } from "./line-broadcast.service";

type MockPrisma = {
  broadcastJob: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  broadcastJob: {
    findMany: jest.fn<Promise<unknown>, [unknown]>()
  }
});

describe("LineBroadcastScheduler", () => {
  it("processes pending jobs scheduled for the past or now", async () => {
    const prisma = createPrisma();
    prisma.broadcastJob.findMany.mockResolvedValue([
      { id: "job-1" },
      { id: "job-2" }
    ]);

    const broadcastService = {
      executeBroadcastJob: jest.fn<Promise<void>, [string]>().mockResolvedValue()
    } as unknown as LineBroadcastService;

    const scheduler = new LineBroadcastScheduler(
      prisma as unknown as PrismaService,
      broadcastService
    );

    await scheduler.handleScheduledBroadcasts();

    // Verify it queries the database for pending jobs
    expect(prisma.broadcastJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BroadcastStatus.PENDING,
          scheduledAt: expect.any(Object)
        })
      })
    );

    // Verify executeBroadcastJob was called for each job
    expect(broadcastService.executeBroadcastJob).toHaveBeenCalledTimes(2);
    expect(broadcastService.executeBroadcastJob).toHaveBeenCalledWith("job-1");
    expect(broadcastService.executeBroadcastJob).toHaveBeenCalledWith("job-2");
  });
});
