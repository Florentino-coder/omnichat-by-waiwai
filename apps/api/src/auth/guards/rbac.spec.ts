import { Controller, Get, INestApplication, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";
import { HttpExceptionFilter } from "../../common/http/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "../../common/http/response-envelope.interceptor";
import { PrismaService } from "../../prisma/prisma.service";
import { Roles } from "../decorators/roles.decorator";
import { TenantCtx } from "../decorators/tenant-context.decorator";
import { JwtTenantPayload } from "../types/auth.types";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { TenantGuard } from "./tenant.guard";

@Controller("guard-check")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
class GuardCheckController {
  @Get("admin")
  @Roles(Role.ADMIN)
  adminOnly(@TenantCtx() ctx: JwtTenantPayload): { tenantId: string; role: Role } {
    return {
      tenantId: ctx.tenantId,
      role: ctx.role
    };
  }

  @Get("tenant")
  tenantOnly(@TenantCtx() ctx: JwtTenantPayload): { tenantId: string } {
    return {
      tenantId: ctx.tenantId
    };
  }
}

describe("RBAC and tenant guards", () => {
  const jwtSecret = "test-jwt-secret";
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GuardCheckController],
      providers: [
        JwtAuthGuard,
        TenantGuard,
        RolesGuard,
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string): string | undefined =>
              key === "JWT_SECRET" ? jwtSecret : undefined
          }
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: "user-1",
                isActive: true,
                deletedAt: null,
                emailVerified: true,
                isSuperOwner: false
              })
            },
            workspaceMember: {
              findFirst: jest.fn().mockResolvedValue({ id: "member-1" })
            }
          }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(new Reflector()));
    await app.init();

    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows admin role and returns success envelope with tenant context", async () => {
    const token = signToken(Role.ADMIN);

    await request(app.getHttpServer())
      .get("/guard-check/admin")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect({
        success: true,
        data: {
          tenantId: "tenant-1",
          role: Role.ADMIN
        }
      });
  });

  it("allows owner role to pass admin routes", async () => {
    const token = signToken(Role.OWNER);

    await request(app.getHttpServer())
      .get("/guard-check/admin")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("denies agent role on admin routes with error envelope", async () => {
    const token = signToken(Role.AGENT);

    await request(app.getHttpServer())
      .get("/guard-check/admin")
      .set("Authorization", `Bearer ${token}`)
      .expect(403)
      .expect({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Insufficient role"
        }
      });
  });

  it("denies requests without tenant context", async () => {
    const token = jwtService.sign(
      {
        sub: "user-1",
        email: "agent@example.com",
        role: Role.AGENT
      },
      { secret: jwtSecret }
    );

    await request(app.getHttpServer())
      .get("/guard-check/tenant")
      .set("Authorization", `Bearer ${token}`)
      .expect(401)
      .expect({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid token context"
        }
      });
  });

  function signToken(role: Role): string {
    return jwtService.sign(
      {
        sub: "user-1",
        email: "user@example.com",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role
      },
      { secret: jwtSecret }
    );
  }
});
