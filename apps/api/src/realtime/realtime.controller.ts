import { Controller, ForbiddenException, Header, MessageEvent, Param, Sse, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Observable, map } from "rxjs";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { RealtimeService } from "./realtime.service";
import { MonitorService } from "../monitor/monitor.service";

@Controller("sse")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly monitorService?: MonitorService
  ) {}

  @Sse("tenant/:tenantId")
  @Header("X-Accel-Buffering", "no")
  @Header("Cache-Control", "no-cache")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  streamTenantEvents(
    @Param("tenantId") tenantId: string,
    @TenantCtx() ctx: JwtTenantPayload
  ): Observable<MessageEvent> {
    if (tenantId !== ctx.tenantId) {
      throw new ForbiddenException("Tenant stream mismatch");
    }

    return this.realtimeService.streamTenantEvents(tenantId).pipe(
      map((event) => {
        const data = toMessageEventData(event.data);
        const traceTs = Date.now();
        if (event.flowId) {
          console.log(`[TRACE] [SSE_SEND] flowId=${event.flowId} ts=${traceTs} time=${new Date(traceTs).toISOString()}`);
          if (this.monitorService) {
            void this.monitorService.recordEvent(event.flowId, "SSE_SEND", traceTs);
          }
        }
        return {
          type: event.type,
          data: event.flowId && typeof data === "object" && data !== null
            ? { ...data, flowId: event.flowId, traceTs }
            : data
        };
      })
    );
  }
}

function toMessageEventData(data: unknown): string | object {
  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && data !== null) {
    return data;
  }

  return { value: data };
}
