import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { MonitorService } from "./monitor.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperOwnerGuard } from "../super-admin/guards/super-owner.guard";

@Controller()
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  // ============================================================
  // Telemetry Ingestion Endpoints (Authenticated)
  // ============================================================

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ telemetry: { limit: 600, ttl: 60_000 } })
  @Post("monitor/browser-received")
  async browserReceived(
    @Body() payload: { flowId: string; timestamp: number }
  ) {
    if (payload.flowId) {
      console.log(`[TRACE] [BACKEND_BROWSER_RECEIVED_ACK] flowId=${payload.flowId} ts=${payload.timestamp} time=${new Date(payload.timestamp).toISOString()}`);
      await this.monitorService.recordEvent(payload.flowId, "BROWSER_RECEIVED", payload.timestamp);
    }
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ telemetry: { limit: 600, ttl: 60_000 } })
  @Post("telemetry/client-trace")
  async clientTrace(
    @Body() payload: { flowId: string; stage: string; timestamp: number }
  ) {
    if (payload.flowId && payload.stage) {
      console.log(`[TRACE] [${payload.stage}] flowId=${payload.flowId} ts=${payload.timestamp} time=${new Date(payload.timestamp).toISOString()}`);
      await this.monitorService.recordEvent(payload.flowId, payload.stage, payload.timestamp);
    }
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ telemetry: { limit: 600, ttl: 60_000 } })
  @Post("monitor/ui-rendered")
  async uiRendered(
    @Body() payload: {
      flowId: string;
      duration: number;
      startTimestamp?: number;
      endTimestamp?: number;
      sseReceived?: number;
      stateUpdate?: number;
      componentRender?: number;
    }
  ) {
    if (payload.flowId) {
      // Record UI render start/end timestamps if available
      const end = payload.endTimestamp ?? Date.now();
      const start = payload.startTimestamp ?? (end - payload.duration);
      
      await this.monitorService.recordEvent(payload.flowId, "UI_RENDER_START", start);
      await this.monitorService.recordEvent(payload.flowId, "UI_RENDER_END", end);

      if (payload.sseReceived) {
        await this.monitorService.recordEvent(payload.flowId, "SSE_RECEIVED", payload.sseReceived);
      }
      if (payload.stateUpdate) {
        await this.monitorService.recordEvent(payload.flowId, "STATE_UPDATE", payload.stateUpdate);
      }
      if (payload.componentRender) {
        await this.monitorService.recordEvent(payload.flowId, "COMPONENT_RENDER", payload.componentRender);
      }
    }
    return { success: true };
  }

  // ============================================================
  // Admin Dashboard Endpoints (SuperOwner Only)
  // ============================================================

  @UseGuards(JwtAuthGuard, SuperOwnerGuard)
  @Get("admin/monitor")
  async listRecent() {
    const list = await this.monitorService.listRecent();
    return { success: true, data: list };
  }

  @UseGuards(JwtAuthGuard, SuperOwnerGuard)
  @Get("admin/monitor/stats")
  async getStats() {
    const stats = await this.monitorService.getStats();
    return { success: true, data: stats };
  }

  @UseGuards(JwtAuthGuard, SuperOwnerGuard)
  @Get("admin/monitor/slowest")
  async getSlowest() {
    const list = await this.monitorService.getSlowest();
    return { success: true, data: list };
  }

  @UseGuards(JwtAuthGuard, SuperOwnerGuard)
  @Get("admin/monitor/:flowId")
  async getDetail(@Param("flowId") flowId: string) {
    const detail = await this.monitorService.getFlowDetail(flowId);
    return { success: true, data: detail };
  }
}
