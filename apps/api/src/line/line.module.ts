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
  createInlineLineWebhookQueue,
  createLineWebhookQueue,
  createNoopLineWebhookQueue,
  isBullmqLineWebhookQueueEnabled,
  LINE_WEBHOOK_QUEUE,
  LineWebhookQueueService
} from "./line-webhook-queue.service";
import { LineWebhookProcessorService } from "./line-webhook-processor.service";
import { LineWebhookService } from "./line-webhook.service";
import { StorageModule } from "../storage/storage.module";
import { LineBroadcastService } from "./line-broadcast.service";
import { LineBroadcastScheduler } from "./line-broadcast.scheduler";
import { MonitorModule } from "../monitor/monitor.module";

@Module({
  imports: [AuthModule, PrismaModule, RealtimeModule, StorageModule, MonitorModule],
  controllers: [LineChannelsController, LineWebhookController],
  providers: [
    LineChannelsService,
    LineReplyService,
    LineSignatureService,
    LineWebhookService,
    LineBroadcastService,
    LineBroadcastScheduler,
    {
      provide: LINE_WEBHOOK_QUEUE,
      inject: [ConfigService, LineWebhookService],
      useFactory: (configService: ConfigService, lineWebhookService: LineWebhookService) => {
        if (process.env.NODE_ENV === "test") {
          return createNoopLineWebhookQueue();
        }

        if (isBullmqLineWebhookQueueEnabled(configService.get<string>("LINE_WEBHOOK_QUEUE_MODE"))) {
          return createLineWebhookQueue(
            configService.get<string>("REDIS_URL") ?? "redis://localhost:6379"
          );
        }

        return createInlineLineWebhookQueue(lineWebhookService);
      }
    },
    LineWebhookQueueService,
    LineWebhookProcessorService
  ]
})
export class LineModule {}
