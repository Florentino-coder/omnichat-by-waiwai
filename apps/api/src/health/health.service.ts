import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Socket } from "node:net";
import { PrismaService } from "../prisma/prisma.service";
import { HealthCheckResponse, HealthServiceStatus } from "./types/health.types";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async check(): Promise<HealthCheckResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis()
    ]);

    return {
      status: database === "up" && redis === "up" ? "ok" : "degraded",
      services: {
        database,
        redis
      }
    };
  }

  private async checkDatabase(): Promise<HealthServiceStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    }
  }

  private async checkRedis(): Promise<HealthServiceStatus> {
    const redisUrl = this.configService.get<string>("REDIS_URL");

    if (!redisUrl) {
      return "not_configured";
    }

    try {
      const url = new URL(redisUrl);
      const port = Number(url.port || 6379);
      await this.tcpCheck(url.hostname, port);
      return "up";
    } catch {
      return "down";
    }
  }

  private tcpCheck(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const cleanup = (): void => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(1000);
      socket.once("connect", () => {
        cleanup();
        resolve();
      });
      socket.once("error", (error) => {
        cleanup();
        reject(error);
      });
      socket.once("timeout", () => {
        cleanup();
        reject(new Error("Redis health check timed out"));
      });
      socket.connect(port, host);
    });
  }
}
