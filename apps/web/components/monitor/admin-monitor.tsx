"use client";

import { useEffect, useState, useRef } from "react";
import { Activity, Clock, AlertTriangle, ShieldCheck, Flame, RefreshCw, BarChart2, Eye, Server, Compass, Zap } from "lucide-react";
import { Badge, Button, Card } from "@omnichat/ui";
import { apiFetch } from "../../app/lib/api-client";

interface FlowSummary {
  flowId: string;
  timestamp: number;
  totalLatency: number;
  bottleneck: string;
  status: "ok" | "warning" | "critical";
  hasError: boolean;
}

interface StageMetrics {
  dbSave: number;
  redisPub: number;
  sseDelivery: number;
  uiRender: number;
  stateUpdateDelay?: number;
  reactRenderDelay?: number;
}

interface MonitorStats {
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  bottleneckDistribution: Record<string, number>;
  stageMetrics: StageMetrics;
}

interface TimelineEvent {
  name: string;
  timestamp: number;
}

interface FlowTraceDetail {
  flowId: string;
  timestamp: number;
  events: TimelineEvent[];
  totalLatency: number;
  bottleneck: string;
  status: "ok" | "warning" | "critical";
  hasError: boolean;
}

export default function AdminMonitor() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [slowest, setSlowest] = useState<FlowSummary[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<FlowTraceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const refreshIntervalRef = useRef<number | undefined>(undefined);

  const fetchTelemetryData = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      const [statsRes, flowsRes, slowestRes] = await Promise.all([
        apiFetch<MonitorStats>("/api/v1/admin/monitor/stats"),
        apiFetch<FlowSummary[]>("/api/v1/admin/monitor"),
        apiFetch<FlowSummary[]>("/api/v1/admin/monitor/slowest")
      ]);

      setStats(statsRes);
      setFlows(Array.isArray(flowsRes) ? flowsRes : []);
      setSlowest(Array.isArray(slowestRes) ? slowestRes : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load telemetry stats.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchFlowDetail = async (flowId: string) => {
    try {
      const detail = await apiFetch<FlowTraceDetail>(`/api/v1/admin/monitor/${flowId}`);
      setSelectedFlow(detail);
    } catch (err) {
      console.error("Failed to load flow trace details", err);
    }
  };

  useEffect(() => {
    void fetchTelemetryData();

    // Poll telemetry data every 3 seconds for realtime feel
    refreshIntervalRef.current = window.setInterval(() => {
      void fetchTelemetryData(true);
    }, 3000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedFlowId) {
      void fetchFlowDetail(selectedFlowId);
    } else {
      setSelectedFlow(null);
    }
  }, [selectedFlowId]);

  if (isLoading && !stats) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading distributed flow metrics...</p>
      </div>
    );
  }

  const stageDurations = stats?.stageMetrics || { dbSave: 0, redisPub: 0, sseDelivery: 0, uiRender: 0 };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Distributed Flow Tracing</h1>
          <p className="text-slate-500">Real-time latency profiling, bottlenecks detection, and browser rendering metrics.</p>
        </div>
        <Button 
          onClick={() => void fetchTelemetryData()} 
          disabled={isRefreshing}
          className="flex items-center gap-2 self-start rounded-xl px-4 py-2 hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh Logs"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col justify-between p-6 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Avg E2E Latency</span>
            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{stats?.avgLatency || 0}ms</span>
            <span className="ml-1 text-xs text-slate-400">average latency</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">P95 Latency</span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <BarChart2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{stats?.p95Latency || 0}ms</span>
            <span className="ml-1 text-xs text-slate-400">95% of flows faster</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">P99 Latency</span>
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
              <Flame className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-rose-600">{stats?.p99Latency || 0}ms</span>
            <span className="ml-1 text-xs text-slate-400">99% of flows faster</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Error Rate</span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{( (stats?.errorRate || 0) * 100).toFixed(2)}%</span>
            <span className="ml-1 text-xs text-slate-400">failed webhooks</span>
          </div>
        </Card>
      </div>

      {/* Latency Breakdown & Bottleneck Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Latency Breakdown */}
        <Card className="lg:col-span-2 p-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
            <Server className="h-5 w-5 text-primary" />
            Telemetry Latency Breakdown
          </h2>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1">
                <span>Database Message Save</span>
                <span className="font-mono text-slate-500">{stageDurations.dbSave}ms</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, (stageDurations.dbSave / Math.max(1, stats?.avgLatency || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1">
                <span>Redis Event Publish</span>
                <span className="font-mono text-slate-500">{stageDurations.redisPub}ms</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, (stageDurations.redisPub / Math.max(1, stats?.avgLatency || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1">
                <span>SSE Stream Delivery (Network)</span>
                <span className="font-mono text-slate-500">{stageDurations.sseDelivery}ms</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-amber-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, (stageDurations.sseDelivery / Math.max(1, stats?.avgLatency || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1">
                <span>React UI Render (Client)</span>
                <span className="font-mono text-slate-500">{stageDurations.uiRender}ms</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-rose-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, (stageDurations.uiRender / Math.max(1, stats?.avgLatency || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {stageDurations.stateUpdateDelay !== undefined && (
              <div>
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1">
                  <span>State Update Delay (Client)</span>
                  <span className="font-mono text-slate-500">{stageDurations.stateUpdateDelay}ms</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${Math.min(100, (stageDurations.stateUpdateDelay / Math.max(1, stats?.avgLatency || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {stageDurations.reactRenderDelay !== undefined && (
              <div>
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1">
                  <span>React Render Delay (Client)</span>
                  <span className="font-mono text-slate-500">{stageDurations.reactRenderDelay}ms</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-teal-500 transition-all duration-500" 
                    style={{ width: `${Math.min(100, (stageDurations.reactRenderDelay / Math.max(1, stats?.avgLatency || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Bottleneck Distribution */}
        <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Slowest Stage Bottlenecks
          </h2>
          <div className="space-y-4">
            {stats && Object.keys(stats.bottleneckDistribution).length > 0 ? (
              Object.entries(stats.bottleneckDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([stage, count]) => {
                  const pct = Math.round((count / (flows.length || 1)) * 100);
                  return (
                    <div key={stage} className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-800 truncate block">{stage}</span>
                        <span className="text-xs text-slate-400">{count} flows identified</span>
                      </div>
                      <Badge className={`px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm ${
                        pct > 50 ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}>
                        {pct}%
                      </Badge>
                    </div>
                  );
                })
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                No bottleneck data calculated yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Live Stream & Detail Viewer */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Live Flow Log Stream */}
        <Card className="xl:col-span-2 p-6 bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col min-h-[480px]">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-indigo-600 animate-pulse" />
            Live Flow Stream
          </h2>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                  <th className="pb-3 pr-4">Flow ID</th>
                  <th className="pb-3 pr-4">Timeline</th>
                  <th className="pb-3 pr-4">E2E Latency</th>
                  <th className="pb-3 pr-4">Bottleneck</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {flows.length > 0 ? (
                  flows.map((flow) => (
                    <tr key={flow.flowId} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 pr-4 font-mono font-bold text-slate-700">{flow.flowId}</td>
                      <td className="py-3.5 pr-4 text-xs text-slate-400">
                        {new Date(flow.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          flow.status === "critical" ? "text-red-600" : flow.status === "warning" ? "text-amber-600" : "text-emerald-600"
                        }`}>
                          {flow.totalLatency}ms
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                          {flow.bottleneck}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <Button 
                          onClick={() => setSelectedFlowId(flow.flowId)}
                          className="px-2 py-1 text-xs hover:bg-primary-soft hover:text-primary transition-colors flex items-center gap-1 ml-auto rounded-lg border border-slate-100 bg-white shadow-sm"
                        >
                          <Eye className="h-3 w-3" /> Inspect
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Waiting for active LINE webhook events...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Selected Flow Inspector Panel */}
        <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col justify-between min-h-[480px]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Compass className="h-5 w-5 text-indigo-600" />
              Trace Inspector
            </h2>

            {selectedFlow ? (
              <div className="space-y-6">
                {/* Meta details */}
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Flow ID</span>
                    <span className="font-mono font-bold text-slate-800">{selectedFlow.flowId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Total Latency</span>
                    <span className={`font-bold ${
                      selectedFlow.status === "critical" ? "text-red-600" : selectedFlow.status === "warning" ? "text-amber-600" : "text-emerald-600"
                    }`}>{selectedFlow.totalLatency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Bottleneck</span>
                    <span className="font-bold text-slate-800">{selectedFlow.bottleneck}</span>
                  </div>
                  {selectedFlow.hasError ? (
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Status</span>
                      <span className="font-bold text-red-600">Failed / Webhook Error</span>
                    </div>
                  ) : null}
                </div>

                {/* Timeline stages */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Milestone Timeline</h3>
                  <div className="relative pl-6 border-l-2 border-slate-100 space-y-4">
                    {selectedFlow.events
                      .sort((a, b) => a.timestamp - b.timestamp)
                      .map((event, index, array) => {
                        const elapsed = index > 0 ? event.timestamp - array[index - 1].timestamp : 0;
                        return (
                          <div key={event.name} className="relative">
                            <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-500 shadow-sm" />
                            <div className="text-xs">
                              <span className="font-bold text-slate-800 block">{event.name}</span>
                              <span className="text-slate-400">
                                {new Date(event.timestamp).toLocaleTimeString()}{" "}
                                {index > 0 ? `(+${elapsed}ms)` : ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-80 flex-col items-center justify-center gap-2 text-center text-slate-400">
                <Zap className="h-8 w-8 text-slate-300" />
                <p className="text-sm">Select a flow trace to inspect latency timeline events.</p>
              </div>
            )}
          </div>

          {selectedFlow ? (
            <Button 
              onClick={() => setSelectedFlowId(null)}
              className="w-full mt-6 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Clear Inspector
            </Button>
          ) : null}
        </Card>
      </div>

      {/* Slowest Flows Panel */}
      <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-rose-600 animate-bounce" />
          Slowest Logs (Top 10)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                <th className="pb-3 pr-4">Flow ID</th>
                <th className="pb-3 pr-4">Timestamp</th>
                <th className="pb-3 pr-4">Latency</th>
                <th className="pb-3 pr-4">Bottleneck</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {slowest.length > 0 ? (
                slowest.map((flow) => (
                  <tr key={flow.flowId} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pr-4 font-mono font-bold text-slate-700">{flow.flowId}</td>
                    <td className="py-3.5 pr-4 text-xs text-slate-400">
                      {new Date(flow.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        flow.status === "critical" ? "text-red-600" : flow.status === "warning" ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        {flow.totalLatency}ms
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                        {flow.bottleneck}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Button 
                        onClick={() => setSelectedFlowId(flow.flowId)}
                        className="px-2 py-1 text-xs hover:bg-primary-soft hover:text-primary transition-colors flex items-center gap-1 ml-auto rounded-lg border border-slate-100 bg-white shadow-sm"
                      >
                        <Eye className="h-3 w-3" /> Inspect
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No slowest logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
