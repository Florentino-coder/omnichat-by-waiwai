import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "./common/http/response-envelope.interceptor";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
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
