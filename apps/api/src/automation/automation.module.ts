import { Module, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { LineModule } from "../line/line.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AutomationController } from "./automation.controller";
import { AutomationEngineService } from "./automation-engine.service";
import { AutomationProcessorService } from "./automation-processor.service";
import {
  AUTOMATION_QUEUE,
  AutomationQueueService,
  createAutomationQueue,
  createInlineAutomationQueue,
  isBullmqAutomationQueueEnabled
} from "./automation-queue.service";
import { AutomationService } from "./automation.service";
import { AutomationWaitTimeoutScheduler } from "./automation-wait-timeout.scheduler";

@Module({
  imports: [AuthModule, PrismaModule, forwardRef(() => AiModule), forwardRef(() => LineModule)],
  controllers: [AutomationController],
  providers: [
    AutomationService,
    AutomationEngineService,
    AutomationProcessorService,
    {
      provide: AUTOMATION_QUEUE,
      inject: [ConfigService, AutomationProcessorService],
      useFactory: (
        configService: ConfigService,
        automationProcessorService: AutomationProcessorService
      ) => {
        if (process.env.NODE_ENV === "test") {
          return createInlineAutomationQueue(automationProcessorService);
        }

        if (
          isBullmqAutomationQueueEnabled(
            configService.get<string>("AUTOMATION_QUEUE_MODE")
          )
        ) {
          return createAutomationQueue(
            configService.get<string>("REDIS_URL") ?? "redis://localhost:6379"
          );
        }

        return createInlineAutomationQueue(automationProcessorService);
      }
    },
    AutomationQueueService,
    AutomationWaitTimeoutScheduler
  ],
  exports: [AutomationService]
})
export class AutomationModule {}
