import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { LineChannelsController } from "./line-channels.controller";
import { LineWebhookController } from "./line-webhook.controller";
import { LineChannelsService } from "./line-channels.service";
import { LineReplyService } from "./line-reply.service";
import { LineSignatureService } from "./line-signature.service";
import { LineWebhookQueueService } from "./line-webhook-queue.service";
import { LineWebhookService } from "./line-webhook.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [LineChannelsController, LineWebhookController],
  providers: [
    LineChannelsService,
    LineReplyService,
    LineSignatureService,
    LineWebhookService,
    LineWebhookQueueService
  ]
})
export class LineModule {}

