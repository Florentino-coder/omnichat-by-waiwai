import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { ClaudeClient } from "../../src/common/llm/claude.client";
import { GeminiClient } from "../../src/common/llm/gemini.client";
import { OpenAIClient } from "../../src/common/llm/openai.client";
import { LLMClient } from "../../src/common/llm/llm.interface";
import { HttpExceptionFilter } from "../../src/common/http/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "../../src/common/http/response-envelope.interceptor";
import { MailService } from "../../src/mail/mail.service";
import { RedisService } from "../../src/redis/redis.service";
import { createMockLlmClient } from "./mock-llm-client";
import { createInMemoryRedisClient, InMemoryRedisClient } from "./mock-redis-client";

export interface ApiTestAppContext {
  app: INestApplication;
  redisClient: InMemoryRedisClient;
  llmClient: LLMClient;
}

export async function createApiTestApp(): Promise<INestApplication> {
  return (await createApiTestAppWithMocks()).app;
}

export async function createApiTestAppWithMocks(): Promise<ApiTestAppContext> {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
  process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
  process.env.EMAIL_FROM = process.env.EMAIL_FROM ?? "test@omnichat.local";
  process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? "re_test_key";
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64");

  const redisClient = createInMemoryRedisClient();
  const llmClient = createMockLlmClient();

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
    .useValue({ client: redisClient })
    .overrideProvider(GeminiClient)
    .useValue(llmClient)
    .overrideProvider(OpenAIClient)
    .useValue(llmClient)
    .overrideProvider(ClaudeClient)
    .useValue(llmClient)
    .overrideProvider("LLMClient")
    .useValue(llmClient)
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

  return { app, redisClient, llmClient };
}
