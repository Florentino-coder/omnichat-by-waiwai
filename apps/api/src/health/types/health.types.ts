export type HealthServiceStatus = "up" | "down" | "not_configured";

export interface HealthCheckResponse {
  status: "ok" | "degraded";
  services: {
    database: HealthServiceStatus;
    redis: HealthServiceStatus;
  };
}
