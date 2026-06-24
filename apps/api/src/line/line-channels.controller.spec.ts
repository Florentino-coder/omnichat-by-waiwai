import { CanActivate, ConflictException, ExecutionContext, INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { HttpExceptionFilter } from "../common/http/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "../common/http/response-envelope.interceptor";
import { LineBroadcastService } from "./line-broadcast.service";
import { LineChannelsController } from "./line-channels.controller";
import { LineChannelsService } from "./line-channels.service";
import { LineReplyService } from "./line-reply.service";

const tenantUser = {
  sub: "user-1",
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  role: Role.ADMIN
};

const authGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: typeof tenantUser }>();
    req.user = tenantUser;
    return true;
  }
};

describe("LineChannelsController delete broadcast", () => {
  let app: INestApplication;
  const lineBroadcastService = {
    deleteBroadcastJob: jest.fn().mockResolvedValue(undefined)
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LineChannelsController],
      providers: [
        { provide: LineChannelsService, useValue: {} },
        { provide: LineReplyService, useValue: {} },
        { provide: LineBroadcastService, useValue: lineBroadcastService }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(TenantGuard)
      .useValue(authGuard)
      .overrideGuard(RolesGuard)
      .useValue(authGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(new Reflector()));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    lineBroadcastService.deleteBroadcastJob.mockResolvedValue(undefined);
  });

  it("returns 204 with empty body for successful broadcast cancel", async () => {
    const response = await request(app.getHttpServer())
      .delete("/line/channels/channel-1/broadcasts/job-1")
      .expect(204);

    expect(response.body).toEqual({});
    expect(response.text).toBe("");
    expect(lineBroadcastService.deleteBroadcastJob).toHaveBeenCalledWith(
      "tenant-1",
      "channel-1",
      "job-1",
      "user-1"
    );
  });

  it("returns 409 with error envelope when broadcast cannot be cancelled", async () => {
    lineBroadcastService.deleteBroadcastJob.mockRejectedValue(
      new ConflictException("Broadcast has already been sent and cannot be cancelled")
    );

    await request(app.getHttpServer())
      .delete("/line/channels/channel-1/broadcasts/job-sent")
      .expect(409)
      .expect({
        success: false,
        error: {
          code: "CONFLICT",
          message: "Broadcast has already been sent and cannot be cancelled"
        }
      });
  });
});
