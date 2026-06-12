import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";
import { HealthCheckResponse } from "./types/health.types";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthCheckResponse> {
    return this.healthService.check();
  }
}
