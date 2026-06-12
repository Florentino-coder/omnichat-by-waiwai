import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/http/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "../../src/common/http/response-envelope.interceptor";
import { MailService } from "../../src/mail/mail.service";
import { RedisService } from "../../src/redis/redis.service";

export async function createApiTestApp(): Promise<INestApplication> {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
  process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
  process.env.EMAIL_FROM = process.env.EMAIL_FROM ?? "test@omnichat.local";
  process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? "re_test_key";
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64");

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(MailService)
    .useValue({
      sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined)
    })
    .overrideProvider(RedisService)
    .useValue({
      client: {
        set: jest.fn().mockResolvedValue("OK"),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        sadd: jest.fn().mockResolvedValue(1),
        srem: jest.fn().mockResolvedValue(1),
        smembers: jest.fn().mockResolvedValue([]),
        quit: jest.fn().mockResolvedValue(undefined)
      }
    })
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
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
  await app.init();

  return app;
}
