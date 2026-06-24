import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AuditAction, BackupRunStatus, BackupRunType } from "@prisma/client";
import { BackupService } from "./backup.service";
import { PrismaService } from "../prisma/prisma.service";

describe("BackupService", () => {
  let service: BackupService;

  const prisma = {
    backupRun: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    tenant: {
      findFirst: jest.fn()
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "R2_BUCKET_BACKUPS") {
                return "chatwai-backups";
              }
              return undefined;
            })
          }
        },
        {
          provide: PrismaService,
          useValue: prisma
        }
      ]
    }).compile();

    service = module.get(BackupService);
  });

  it("lists recent backup runs", async () => {
    prisma.backupRun.findMany.mockResolvedValue([
      {
        id: "run-1",
        runType: BackupRunType.DAILY,
        status: BackupRunStatus.SUCCESS,
        r2Key: "daily/daily-2026-06-25.sql.gz",
        bucket: "chatwai-backups",
        sizeBytes: BigInt(1024),
        errorMessage: null,
        triggeredByUserId: null,
        startedAt: new Date("2026-06-25T19:00:00.000Z"),
        completedAt: new Date("2026-06-25T19:05:00.000Z"),
        createdAt: new Date("2026-06-25T19:00:00.000Z")
      }
    ]);

    const runs = await service.listRuns(10);

    expect(prisma.backupRun.findMany).toHaveBeenCalledWith({
      orderBy: { startedAt: "desc" },
      take: 10
    });
    expect(runs[0]?.sizeBytes).toBe("1024");
    expect(runs[0]?.r2Key).toBe("daily/daily-2026-06-25.sql.gz");
  });

  it("reports degraded health when the latest success is stale", async () => {
    prisma.backupRun.findFirst
      .mockResolvedValueOnce({
        id: "run-success",
        runType: BackupRunType.DAILY,
        status: BackupRunStatus.SUCCESS,
        r2Key: "daily/daily-old.sql.gz",
        bucket: "chatwai-backups",
        sizeBytes: BigInt(2048),
        errorMessage: null,
        triggeredByUserId: null,
        startedAt: new Date("2026-06-20T19:00:00.000Z"),
        completedAt: new Date("2026-06-20T19:05:00.000Z"),
        createdAt: new Date("2026-06-20T19:00:00.000Z")
      })
      .mockResolvedValueOnce(null);
    prisma.backupRun.count.mockResolvedValue(0);

    const health = await service.getHealth();

    expect(health.status).toBe("degraded");
    expect(health.backupBucket).toBe("chatwai-backups");
    expect(health.latestSuccessfulBackup?.id).toBe("run-success");
  });

  it("writes audit logs for manual backup triggers when a tenant exists", async () => {
    prisma.tenant.findFirst.mockResolvedValue({ id: "tenant-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    prisma.backupRun.create.mockResolvedValue({
      id: "run-manual",
      runType: BackupRunType.MANUAL,
      status: BackupRunStatus.RUNNING,
      r2Key: "manual/manual-test.sql.gz",
      bucket: "chatwai-backups"
    });

    const performBackupSpy = jest
      .spyOn(service, "performBackup")
      .mockResolvedValue({
        id: "run-manual",
        runType: BackupRunType.MANUAL,
        status: BackupRunStatus.SUCCESS,
        r2Key: "manual/manual-test.sql.gz",
        bucket: "chatwai-backups",
        sizeBytes: BigInt(512),
        errorMessage: null,
        triggeredByUserId: "super-owner-1",
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

    await service.triggerManualBackup("super-owner-1");

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "super-owner-1",
        action: AuditAction.BACKUP_RUN_TRIGGERED,
        targetType: "BackupRun"
      })
    });
    expect(performBackupSpy).toHaveBeenCalledWith(
      expect.stringContaining("manual/manual-"),
      BackupRunType.MANUAL,
      "super-owner-1"
    );
  });
});
