import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createResendEmailProvider, MAIL_PROVIDER, MailService } from "./mail.service";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>("RESEND_API_KEY");
        if (!apiKey) {
          throw new Error("RESEND_API_KEY is not configured");
        }
        return createResendEmailProvider(apiKey);
      }
    },
    MailService
  ],
  exports: [MailService]
})
export class MailModule {}
