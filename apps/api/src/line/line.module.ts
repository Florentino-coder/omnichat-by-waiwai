import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { LineChannelsController } from "./line-channels.controller";
import { LineWebhookController } from "./line-webhook.controller";
import { LineChannelsService } from "./line-channels.service";
import { LineReplyService } from "./line-reply.service";
import { LineSignatureService } from "./line-signature.service";
import {
  createLineWebhookQueue,
  createNoopLineWebhookQueue,
  LINE_WEBHOOK_QUEUE,
  LineWebhookQueueService
} from "./line-webhook-queue.service";
import { LineWebhookProcessorService } from "./line-webhook-processor.service";
import { LineWebhookService } from "./line-webhook.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [AuthModule, PrismaModule, RealtimeModule, StorageModule],
  controllers: [LineChannelsController, LineWebhookController],
  providers: [
    LineChannelsService,
    LineReplyService,
    LineSignatureService,
    LineWebhookService,
    {
      provide: LINE_WEBHOOK_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        process.env.NODE_ENV === "test"
          ? createNoopLineWebhookQueue()
          : createLineWebhookQueue(
              configService.get<string>("REDIS_URL") ?? "redis://localhost:6379"
            )
    },
    LineWebhookQueueService,
    LineWebhookProcessorService
  ]
})
export class LineModule {}
