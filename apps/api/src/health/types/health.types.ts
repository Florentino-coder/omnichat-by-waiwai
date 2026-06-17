export type HealthServiceStatus = "up" | "down" | "not_configured";

export interface HealthCheckResponse {
  status: "ok" | "degraded";
  services: {
    database: HealthServiceStatus;
    redis: HealthServiceStatus;
    r2: HealthServiceStatus;
  };
  metrics?: {
    memory: {
      rss: string;
      heapUsed: string;
    };
    cpu: {
      loadAvg: number[];
      uptime: string;
    };
  };
}
