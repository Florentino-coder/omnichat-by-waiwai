import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Socket } from "node:net";
import * as os from "node:os";
import { PrismaService } from "../prisma/prisma.service";
import { HealthCheckResponse, HealthServiceStatus } from "./types/health.types";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async check(): Promise<HealthCheckResponse> {
    const [database, redis, r2] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkR2()
    ]);

    const memory = process.memoryUsage();
    const loadAvg = os.loadavg();
    const uptime = process.uptime();

    return {
      status: database === "up" && redis === "up" && r2 !== "down" ? "ok" : "degraded",
      services: {
        database,
        redis,
        r2
      },
      metrics: {
        memory: {
          rss: `${(memory.rss / 1024 / 1024).toFixed(1)} MB`,
          heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`
        },
        cpu: {
          loadAvg,
          uptime: `${(uptime / 3600).toFixed(2)} hours`
        }
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

  private async checkR2(): Promise<HealthServiceStatus> {
    const accountId = this.configService.get<string>("R2_ACCOUNT_ID");
    if (!accountId) {
      return "not_configured";
    }

    try {
      const host = `${accountId}.r2.cloudflarestorage.com`;
      await this.tcpCheck(host, 443);
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
