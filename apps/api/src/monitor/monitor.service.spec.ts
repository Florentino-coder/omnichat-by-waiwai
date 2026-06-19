import { Test, TestingModule } from "@nestjs/testing";
import { MonitorService } from "./monitor.service";
import { RedisService } from "../redis/redis.service";

describe("MonitorService", () => {
  let service: MonitorService;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK")
    };

    const mockRedisService = {
      client: mockRedisClient
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorService,
        {
          provide: RedisService,
          useValue: mockRedisService
        }
      ]
    }).compile();

    service = module.get<MonitorService>(MonitorService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should fall back to in-memory store when Redis fails", async () => {
    mockRedisClient.get.mockRejectedValue(new Error("Redis error"));
    mockRedisClient.set.mockRejectedValue(new Error("Redis error"));

    const flowId = "flow-test-1";
    await service.recordEvent(flowId, "WEBHOOK_RECEIVED", 1000);
    await service.recordEvent(flowId, "DB_SAVE_START", 1010);
    await service.recordEvent(flowId, "DB_SAVE_END", 1050);

    const detail = await service.getFlowDetail(flowId);
    expect(detail).toBeDefined();
    expect(detail?.flowId).toBe(flowId);
    expect(detail?.events).toHaveLength(3);
    expect(detail?.events[0].name).toBe("WEBHOOK_RECEIVED");
    expect(detail?.events[2].timestamp).toBe(1050);
  });

  it("should correctly identify bottleneck stage", async () => {
    const flowId = "flow-test-2";
    
    // Webhook Recv: t=1000
    // DB Save Start: t=1010
    // DB Save End: t=1050 (DB Save duration: 40ms)
    // Redis Pub Start: t=1060
    // Redis Pub End: t=1072 (Redis Pub duration: 12ms)
    // SSE Send: t=1080
    // Browser Recv: t=2880 (SSE Delivery duration: 1800ms)
    // UI Render Start: t=2890
    // UI Render End: t=2925 (UI Render duration: 35ms)
    
    await service.recordEvent(flowId, "WEBHOOK_RECEIVED", 1000);
    await service.recordEvent(flowId, "DB_SAVE_START", 1010);
    await service.recordEvent(flowId, "DB_SAVE_END", 1050);
    await service.recordEvent(flowId, "REDIS_PUBLISH_START", 1060);
    await service.recordEvent(flowId, "REDIS_PUBLISH_END", 1072);
    await service.recordEvent(flowId, "SSE_SEND", 1080);
    await service.recordEvent(flowId, "BROWSER_RECEIVED", 2880);
    await service.recordEvent(flowId, "UI_RENDER_START", 2890);
    await service.recordEvent(flowId, "UI_RENDER_END", 2925);

    const detail = await service.getFlowDetail(flowId);
    expect(detail?.bottleneck).toBe("Browser Receive Delay");
    expect(detail?.totalLatency).toBe(1925); // 2925 - 1000
    expect(detail?.status).toBe("warning"); // latency > 1000ms
  });

  it("should flag status as critical when latency exceeds 3000ms", async () => {
    const flowId = "flow-test-3";
    await service.recordEvent(flowId, "WEBHOOK_RECEIVED", 1000);
    await service.recordEvent(flowId, "UI_RENDER_END", 4500);

    const detail = await service.getFlowDetail(flowId);
    expect(detail?.status).toBe("critical");
  });

  it("should aggregate stats correctly including percentiles", async () => {
    // Record three completed flows
    const flow1 = "flow-1";
    await service.recordEvent(flow1, "WEBHOOK_RECEIVED", 1000);
    await service.recordEvent(flow1, "UI_RENDER_END", 1200); // 200ms latency

    const flow2 = "flow-2";
    await service.recordEvent(flow2, "WEBHOOK_RECEIVED", 2000);
    await service.recordEvent(flow2, "UI_RENDER_END", 2500); // 500ms latency

    const flow3 = "flow-3";
    await service.recordEvent(flow3, "WEBHOOK_RECEIVED", 3000);
    await service.recordEvent(flow3, "UI_RENDER_END", 4100); // 1100ms latency (warning)

    const stats = await service.getStats();
    expect(stats.avgLatency).toBe(600); // (200 + 500 + 1100) / 3 = 600ms
    expect(stats.p95Latency).toBeDefined();
    expect(stats.p99Latency).toBeDefined();
    expect(stats.errorRate).toBe(0); // No errors recorded
  });

  it("should compute slowest flows list", async () => {
    const flow1 = "flow-1";
    await service.recordEvent(flow1, "WEBHOOK_RECEIVED", 1000);
    await service.recordEvent(flow1, "UI_RENDER_END", 1100); // 100ms

    const flow2 = "flow-2";
    await service.recordEvent(flow2, "WEBHOOK_RECEIVED", 2000);
    await service.recordEvent(flow2, "UI_RENDER_END", 2900); // 900ms

    const slowest = await service.getSlowest();
    expect(slowest).toHaveLength(2);
    expect(slowest[0].flowId).toBe("flow-2"); // flow-2 is slower than flow-1
  });
});
