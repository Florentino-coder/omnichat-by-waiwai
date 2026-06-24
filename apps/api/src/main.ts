import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "./common/http/response-envelope.interceptor";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  logger.log(`Bootstrapping API (NODE_ENV=${process.env.NODE_ENV ?? "unknown"})`);
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.enableShutdownHooks();

  const host = process.env.HOST ?? "0.0.0.0";
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, host);
  logger.log(`API listening on http://${host}:${port}`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");
  logger.error(
    "Failed to start API",
    error instanceof Error ? error.stack : String(error)
  );
  process.exit(1);
});
