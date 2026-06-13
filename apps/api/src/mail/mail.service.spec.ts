import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { MailModule } from "./mail.module";
import { MailService } from "./mail.service";

type ResendEmailSend = jest.Mock<Promise<unknown>, [unknown]>;

const createService = (send: ResendEmailSend): MailService => {
  const config = {
    get: (key: string): string | undefined => {
      const values: Record<string, string> = {
        APP_BASE_URL: "https://app.omnichat.test",
        EMAIL_FROM: "OmniChat <no-reply@omnichat.test>",
        RESEND_API_KEY: "re_test"
      };
      return values[key];
    }
  };

  return new MailService(config as ConfigService, { emails: { send } });
};

describe("MailService", () => {
  it("sends invitation email with accept link", async () => {
    const send = jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({ id: "email-1" });

    await createService(send).sendInvitationEmail({
      to: "agent@example.com",
      inviteToken: "invite-token",
      tenantName: "Acme",
      workspaceName: "Support",
      expiresAt: new Date("2026-06-19T00:00:00.000Z")
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "OmniChat <no-reply@omnichat.test>",
        to: "agent@example.com",
        html: expect.stringContaining(
          "https://app.omnichat.test/invite/accept?token=invite-token"
        )
      })
    );
  });

  it("sends verification, reset, and welcome emails with deterministic links", async () => {
    const send = jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({ id: "email-1" });
    const service = createService(send);

    await service.sendEmailVerification({ to: "user@example.com", token: "verify-token" });
    await service.sendPasswordReset({
      to: "user@example.com",
      token: "reset-token",
      expiresAt: new Date("2026-06-19T00:00:00.000Z")
    });
    await service.sendWelcomeEmail({ to: "user@example.com", displayName: "Nicha" });

    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        html: expect.stringContaining(
          "https://app.omnichat.test/verify-email?token=verify-token"
        )
      })
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        html: expect.stringContaining(
          "https://app.omnichat.test/reset-password?token=reset-token"
        )
      })
    );
    expect(send).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        html: expect.stringContaining("Nicha")
      })
    );
    expect(send).toHaveBeenNthCalledWith(
      3,
      expect.not.objectContaining({
        html: expect.stringContaining("token=")
      })
    );
  });

  it("hides provider internals when email delivery fails", async () => {
    const send = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockRejectedValue(new Error("provider says RESEND_API_KEY=re_test failed"));

    await expect(
      createService(send).sendWelcomeEmail({
        to: "user@example.com",
        displayName: "Nicha"
      })
    ).rejects.toThrow(new ServiceUnavailableException("Email delivery failed"));
  });

  it("can be created by Nest dependency injection", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              APP_BASE_URL: "https://app.omnichat.test",
              EMAIL_FROM: "OmniChat <no-reply@omnichat.test>",
              RESEND_API_KEY: "re_test"
            })
          ]
        }),
        MailModule
      ]
    }).compile();

    const service = moduleRef.get(MailService);

    expect(service).toBeDefined();
    await moduleRef.close();
  });
});
