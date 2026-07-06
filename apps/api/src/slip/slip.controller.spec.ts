import { Test, TestingModule } from "@nestjs/testing";
import { SlipController } from "./slip.controller";
import { SlipService } from "./slip.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";

describe("SlipController", () => {
  let controller: SlipController;
  let slipService: any;

  beforeEach(async () => {
    slipService = {
      getVerifications: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        summary: {
          verifiedCount: 0,
          invalidCount: 0,
          duplicateCount: 0,
          pendingCount: 0,
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlipController],
      providers: [
        {
          provide: SlipService,
          useValue: slipService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SlipController>(SlipController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should call slipService.getVerifications with correct arguments", async () => {
    const ctx = { tenantId: "tenant-1" } as any;
    const result = await controller.getVerifications(
      ctx,
      "channel-1",
      "VERIFIED",
      "2026-01-01",
      "2026-01-02",
      "search-term",
      "2",
      "10"
    );

    expect(slipService.getVerifications).toHaveBeenCalledWith("tenant-1", {
      lineChannelId: "channel-1",
      verifyStatus: "VERIFIED",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-02",
      search: "search-term",
      offset: 10,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      total: 0,
      summary: {
        verifiedCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        pendingCount: 0,
      },
    });
  });
});
