import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

export interface TimelineEvent {
  name: string;
  timestamp: number;
}

export interface FlowTrace {
  flowId: string;
  timestamp: number;
  events: TimelineEvent[];
  totalLatency?: number;
  bottleneck?: string;
  status: "ok" | "warning" | "critical";
  hasError: boolean;
}

export interface FlowSummary {
  flowId: string;
  timestamp: number;
  totalLatency: number;
  bottleneck: string;
  status: "ok" | "warning" | "critical";
  hasError: boolean;
}

const MAX_FLOWS = 500;

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);
  
  // In-memory fallback structures
  private inMemoryTraces = new Map<string, FlowTrace>();
  private inMemorySummary: FlowSummary[] = [];

  constructor(private readonly redisService: RedisService) {}

  private async getFromStore(key: string): Promise<string | null> {
    try {
      return await this.redisService.client.get(key);
    } catch (err) {
      this.logger.warn(`Redis get failed, falling back to memory: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async saveToStore(key: string, value: string): Promise<boolean> {
    try {
      await this.redisService.client.set(key, value, "EX", 86400); // 1-day TTL
      return true;
    } catch (err) {
      this.logger.warn(`Redis set failed, falling back to memory: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async recordEvent(flowId: string, eventName: string, timestamp?: number): Promise<void> {
    const ts = timestamp ?? Date.now();
    let trace: FlowTrace | undefined;

    const key = `flow:trace:${flowId}`;
    const stored = await this.getFromStore(key);

    if (stored) {
      try {
        trace = JSON.parse(stored) as FlowTrace;
      } catch {
        // Ignore JSON error
      }
    } else {
      trace = this.inMemoryTraces.get(flowId);
    }

    if (!trace) {
      trace = {
        flowId,
        timestamp: ts,
        events: [],
        status: "ok",
        hasError: false
      };
    }

    // Add event if not duplicate
    if (!trace.events.some(e => e.name === eventName)) {
      trace.events.push({ name: eventName, timestamp: ts });
    }

    if (eventName === "LINE_WEBHOOK_FAILED") {
      trace.hasError = true;
    }

    this.calculateMetrics(trace);

    // Save trace
    const serialized = JSON.stringify(trace);
    await this.saveToStore(key, serialized);
    this.inMemoryTraces.set(flowId, trace);

    // Update Summary list
    await this.updateSummaryList(trace);
  }

  private calculateMetrics(trace: FlowTrace): void {
    const events = trace.events;
    const webhookRecv = events.find(e => e.name === "WEBHOOK_RECEIVED")?.timestamp;
    const dbSaveStart = events.find(e => e.name === "DB_SAVE_START")?.timestamp;
    const dbSaveEnd = events.find(e => e.name === "DB_SAVE_END")?.timestamp;
    const redisPub = events.find(e => e.name === "REDIS_PUBLISH")?.timestamp || events.find(e => e.name === "REDIS_PUBLISH_START")?.timestamp;
    const sseSend = events.find(e => e.name === "SSE_SEND")?.timestamp;
    
    // Client-side traces
    const browserRecv = events.find(e => e.name === "BROWSER_RECEIVE")?.timestamp || events.find(e => e.name === "BROWSER_RECEIVED")?.timestamp || events.find(e => e.name === "SSE_RECEIVED")?.timestamp;
    const stateUpdate = events.find(e => e.name === "STATE_UPDATE")?.timestamp || events.find(e => e.name === "UI_RENDER_START")?.timestamp;
    const reactRenderEnd = events.find(e => e.name === "REACT_RENDER_END")?.timestamp || events.find(e => e.name === "UI_RENDER_END")?.timestamp;
    const domPainted = events.find(e => e.name === "DOM_PAINTED")?.timestamp;

    // 7 main stages requested
    const dbSave = dbSaveStart && dbSaveEnd ? dbSaveEnd - dbSaveStart : 0;
    const redisPublish = dbSaveEnd && redisPub ? redisPub - dbSaveEnd : 0;
    const sseDelivery = redisPub && sseSend ? sseSend - redisPub : 0;
    const browserReceiveDelay = sseSend && browserRecv ? browserRecv - sseSend : 0;
    const stateUpdateDelay = browserRecv && stateUpdate ? stateUpdate - browserRecv : 0;
    const reactRenderDelay = stateUpdate && reactRenderEnd ? reactRenderEnd - stateUpdate : 0;
    const domPaintDelay = reactRenderEnd && domPainted ? domPainted - reactRenderEnd : 0;

    // Legacy/Fallback helper values for compatibility
    const legacySseDelivery = sseSend && browserRecv ? browserRecv - sseSend : 0;

    // Identify bottleneck using the requested stages
    const durations = [
      { stage: "Database Save", val: dbSave },
      { stage: "Redis Publish", val: redisPublish },
      { stage: "SSE Delivery", val: sseDelivery || legacySseDelivery },
      { stage: "Browser Receive Delay", val: browserReceiveDelay },
      { stage: "State Update Delay", val: stateUpdateDelay },
      { stage: "React Render Delay", val: reactRenderDelay },
      { stage: "DOM Paint Delay", val: domPaintDelay }
    ];

    durations.sort((a, b) => b.val - a.val);
    trace.bottleneck = durations[0]?.val > 0 ? durations[0].stage : "N/A";

    // End to end
    const lastEvent = events[events.length - 1];
    if (webhookRecv && lastEvent) {
      trace.totalLatency = lastEvent.timestamp - webhookRecv;
      if (trace.totalLatency > 3000) {
        trace.status = "critical";
      } else if (trace.totalLatency > 1000) {
        trace.status = "warning";
      } else {
        trace.status = "ok";
      }
    }
  }

  private async updateSummaryList(trace: FlowTrace): Promise<void> {
    if (!trace.totalLatency) {
      return;
    }

    const summaryKey = "flow:all_summary";
    let list: FlowSummary[] = [];
    const stored = await this.getFromStore(summaryKey);

    if (stored) {
      try {
        list = JSON.parse(stored) as FlowSummary[];
      } catch {
        // Ignore
      }
    } else {
      list = [...this.inMemorySummary];
    }

    // Upsert
    const newSummary: FlowSummary = {
      flowId: trace.flowId,
      timestamp: trace.timestamp,
      totalLatency: trace.totalLatency || 0,
      bottleneck: trace.bottleneck || "N/A",
      status: trace.status,
      hasError: trace.hasError
    };

    const idx = list.findIndex(item => item.flowId === trace.flowId);
    if (idx >= 0) {
      list[idx] = newSummary;
    } else {
      list.push(newSummary);
    }

    // Sort by timestamp desc
    list.sort((a, b) => b.timestamp - a.timestamp);

    // Limit size
    if (list.length > MAX_FLOWS) {
      list = list.slice(0, MAX_FLOWS);
    }

    await this.saveToStore(summaryKey, JSON.stringify(list));
    this.inMemorySummary = list;
  }

  async listRecent(): Promise<FlowSummary[]> {
    const summaryKey = "flow:all_summary";
    const stored = await this.getFromStore(summaryKey);
    if (stored) {
      try {
        return JSON.parse(stored) as FlowSummary[];
      } catch {
        // Ignore
      }
    }
    return this.inMemorySummary;
  }

  async getFlowDetail(flowId: string): Promise<FlowTrace | null> {
    const key = `flow:trace:${flowId}`;
    const stored = await this.getFromStore(key);
    if (stored) {
      try {
        return JSON.parse(stored) as FlowTrace;
      } catch {
        // Ignore
      }
    }
    return this.inMemoryTraces.get(flowId) || null;
  }

  async getSlowest(): Promise<FlowSummary[]> {
    const recent = await this.listRecent();
    return [...recent]
      .sort((a, b) => b.totalLatency - a.totalLatency)
      .slice(0, 10);
  }

  async getStats(): Promise<any> {
    const recent = await this.listRecent();
    if (recent.length === 0) {
      return {
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 0,
        bottleneckDistribution: {},
        stageMetrics: {
          dbSave: 0,
          redisPub: 0,
          sseDelivery: 0,
          uiRender: 0
        }
      };
    }

    const latencies = recent.map(r => r.totalLatency).sort((a, b) => a - b);
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    const avgLatency = Math.round(sum / latencies.length);

    // Percentiles
    const p95Idx = Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1);
    const p99Idx = Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.99) - 1);
    const p95Latency = latencies[p95Idx] || 0;
    const p99Latency = latencies[p99Idx] || 0;

    // Error rate
    const errors = recent.filter(r => r.hasError).length;
    const errorRate = Number((errors / recent.length).toFixed(4));

    // Bottlenecks
    const bottleneckDistribution: Record<string, number> = {};
    recent.forEach(r => {
      if (r.bottleneck) {
        bottleneckDistribution[r.bottleneck] = (bottleneckDistribution[r.bottleneck] || 0) + 1;
      }
    });

    // Detail stage metrics from full traces
    let totalDbSave = 0, countDbSave = 0;
    let totalRedisPub = 0, countRedisPub = 0;
    let totalSseDelivery = 0, countSseDelivery = 0;
    let totalUiRender = 0, countUiRender = 0;
    let totalStateUpdate = 0, countStateUpdate = 0;
    let totalReactRender = 0, countReactRender = 0;

    const browserReceiveDelays: number[] = [];
    const stateUpdateDelays: number[] = [];
    const reactRenderDelays: number[] = [];
    const domPaintDelays: number[] = [];
    const e2eLatencies: number[] = [];

    for (const item of recent.slice(0, 50)) { // Sample recent 50 for performance
      const detail = await this.getFlowDetail(item.flowId);
      if (detail) {
        const events = detail.events;
        const webhookRecv = events.find(e => e.name === "WEBHOOK_RECEIVED")?.timestamp;
        const dbSaveStart = events.find(e => e.name === "DB_SAVE_START")?.timestamp;
        const dbSaveEnd = events.find(e => e.name === "DB_SAVE_END")?.timestamp;
        const redisPub = events.find(e => e.name === "REDIS_PUBLISH")?.timestamp || events.find(e => e.name === "REDIS_PUBLISH_START")?.timestamp;
        const sseSend = events.find(e => e.name === "SSE_SEND")?.timestamp;
        
        // Client-side traces
        const browserRecv = events.find(e => e.name === "BROWSER_RECEIVE")?.timestamp || events.find(e => e.name === "BROWSER_RECEIVED")?.timestamp || events.find(e => e.name === "SSE_RECEIVED")?.timestamp;
        const stateUpdate = events.find(e => e.name === "STATE_UPDATE")?.timestamp || events.find(e => e.name === "UI_RENDER_START")?.timestamp;
        const reactRenderEnd = events.find(e => e.name === "REACT_RENDER_END")?.timestamp || events.find(e => e.name === "UI_RENDER_END")?.timestamp;
        const domPainted = events.find(e => e.name === "DOM_PAINTED")?.timestamp;

        if (dbSaveStart && dbSaveEnd) {
          totalDbSave += (dbSaveEnd - dbSaveStart);
          countDbSave++;
        }
        if (dbSaveEnd && redisPub) {
          totalRedisPub += (redisPub - dbSaveEnd);
          countRedisPub++;
        }
        
        const legacySseDelivery = sseSend && browserRecv ? browserRecv - sseSend : 0;
        const sseDeliveryVal = redisPub && sseSend ? sseSend - redisPub : legacySseDelivery;
        if (sseDeliveryVal > 0) {
          totalSseDelivery += sseDeliveryVal;
          countSseDelivery++;
        }

        const uiRenderVal = stateUpdate && reactRenderEnd ? reactRenderEnd - stateUpdate : 0;
        if (uiRenderVal > 0) {
          totalUiRender += uiRenderVal;
          countUiRender++;
        }

        // Delays for percentiles
        if (sseSend && browserRecv) {
          browserReceiveDelays.push(browserRecv - sseSend);
        }
        if (browserRecv && stateUpdate) {
          stateUpdateDelays.push(stateUpdate - browserRecv);
          totalStateUpdate += (stateUpdate - browserRecv);
          countStateUpdate++;
        }
        if (stateUpdate && reactRenderEnd) {
          reactRenderDelays.push(reactRenderEnd - stateUpdate);
          totalReactRender += (reactRenderEnd - stateUpdate);
          countReactRender++;
        }
        if (reactRenderEnd && domPainted) {
          domPaintDelays.push(domPainted - reactRenderEnd);
        }
        if (webhookRecv && domPainted) {
          e2eLatencies.push(domPainted - webhookRecv);
        }
      }
    }

    const getPercentile = (arr: number[], pct: number): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * (pct / 100)) - 1);
      return sorted[idx] || 0;
    };

    const p50BrowserReceive = getPercentile(browserReceiveDelays, 50);
    const p95BrowserReceive = getPercentile(browserReceiveDelays, 95);

    const p50StateUpdate = getPercentile(stateUpdateDelays, 50);
    const p95StateUpdate = getPercentile(stateUpdateDelays, 95);

    const p50ReactRender = getPercentile(reactRenderDelays, 50);
    const p95ReactRender = getPercentile(reactRenderDelays, 95);

    const p50DOMPaint = getPercentile(domPaintDelays, 50);
    const p95DOMPaint = getPercentile(domPaintDelays, 95);

    const avgE2EUserVisible = e2eLatencies.length > 0
      ? Math.round(e2eLatencies.reduce((a, b) => a + b, 0) / e2eLatencies.length)
      : 0;

    return {
      avgLatency,
      p95Latency,
      p99Latency,
      errorRate,
      bottleneckDistribution,
      p50BrowserReceive,
      p95BrowserReceive,
      p50StateUpdate,
      p95StateUpdate,
      p50ReactRender,
      p95ReactRender,
      p50DOMPaint,
      p95DOMPaint,
      avgE2EUserVisible,
      stageMetrics: {
        dbSave: countDbSave > 0 ? Math.round(totalDbSave / countDbSave) : 0,
        redisPub: countRedisPub > 0 ? Math.round(totalRedisPub / countRedisPub) : 0,
        sseDelivery: countSseDelivery > 0 ? Math.round(totalSseDelivery / countSseDelivery) : 0,
        uiRender: countUiRender > 0 ? Math.round(totalUiRender / countUiRender) : 0,
        stateUpdateDelay: countStateUpdate > 0 ? Math.round(totalStateUpdate / countStateUpdate) : 0,
        reactRenderDelay: countReactRender > 0 ? Math.round(totalReactRender / countReactRender) : 0
      }
    };
  }
}
