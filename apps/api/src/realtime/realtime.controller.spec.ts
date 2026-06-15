import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

describe("RealtimeController", () => {
  it("rejects SSE streams for a different tenant id", () => {
    const realtimeService = {
      streamTenantEvents: jest.fn()
    };
    const controller = new RealtimeController(realtimeService as unknown as RealtimeService);

    expect(() =>
      controller.streamTenantEvents("tenant-2", {
        sub: "user-1",
        email: "owner@example.com",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.ADMIN
      })
    ).toThrow(ForbiddenException);
    expect(realtimeService.streamTenantEvents).not.toHaveBeenCalled();
  });
});
