import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { MonitorService } from "./monitor.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperOwnerGuard } from "../super-admin/guards/super-owner.guard";

@Controller()
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  // ============================================================
  // Telemetry Ingestion Endpoints (Public)
  // ============================================================

  @Post("monitor/browser-received")
  async browserReceived(
    @Body() payload: { flowId: string; timestamp: number }
  ) {
    if (payload.flowId) {
      await this.monitorService.recordEvent(payload.flowId, "BROWSER_RECEIVED", payload.timestamp);
    }
    return { success: true };
  }

  @Post("monitor/ui-rendered")
  async uiRendered(
    @Body() payload: { flowId: string; duration: number; startTimestamp?: number; endTimestamp?: number }
  ) {
    if (payload.flowId) {
      // Record UI render start/end timestamps if available
      const end = payload.endTimestamp ?? Date.now();
      const start = payload.startTimestamp ?? (end - payload.duration);
      
      await this.monitorService.recordEvent(payload.flowId, "UI_RENDER_START", start);
      await this.monitorService.recordEvent(payload.flowId, "UI_RENDER_END", end);
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
