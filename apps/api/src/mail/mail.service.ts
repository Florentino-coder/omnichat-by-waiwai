import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import {
  EmailProvider,
  InvitationEmailPayload,
  TokenEmailPayload,
  WelcomeEmailPayload
} from "./types/mail.types";

@Injectable()
export class MailService {
  private readonly provider: EmailProvider;

  constructor(
    private readonly configService: ConfigService,
    provider?: EmailProvider
  ) {
    this.provider =
      provider ??
      (new Resend(this.requiredConfig("RESEND_API_KEY")) as unknown as EmailProvider);
  }

  async sendInvitationEmail(payload: InvitationEmailPayload): Promise<void> {
    const link = this.link("/invite/accept", payload.inviteToken);
    await this.send({
      to: payload.to,
      subject: `You're invited to ${payload.tenantName}`,
      html: [
        `<p>You have been invited to ${this.escape(payload.workspaceName)} in ${this.escape(payload.tenantName)}.</p>`,
        `<p><a href="${link}">Accept invitation</a></p>`,
        `<p>This invitation expires at ${payload.expiresAt.toISOString()}.</p>`
      ].join("")
    });
  }

  async sendEmailVerification(payload: TokenEmailPayload): Promise<void> {
    await this.send({
      to: payload.to,
      subject: "Verify your OmniChat email",
      html: `<p><a href="${this.link("/verify-email", payload.token)}">Verify email</a></p>`
    });
  }

  async sendPasswordReset(payload: TokenEmailPayload): Promise<void> {
    await this.send({
      to: payload.to,
      subject: "Reset your OmniChat password",
      html: [
        `<p><a href="${this.link("/reset-password", payload.token)}">Reset password</a></p>`,
        payload.expiresAt ? `<p>This link expires at ${payload.expiresAt.toISOString()}.</p>` : ""
      ].join("")
    });
  }

  async sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
    await this.send({
      to: payload.to,
      subject: "Welcome to OmniChat",
      html: `<p>Welcome, ${this.escape(payload.displayName)}.</p>`
    });
  }

  private async send(payload: Omit<Parameters<EmailProvider["emails"]["send"]>[0], "from">): Promise<void> {
    try {
      await this.provider.emails.send({
        from: this.requiredConfig("EMAIL_FROM"),
        ...payload
      });
    } catch {
      throw new ServiceUnavailableException("Email delivery failed");
    }
  }

  private link(path: string, token: string): string {
    const baseUrl = this.requiredConfig("APP_BASE_URL").replace(/\/+$/, "");
    return `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  private requiredConfig(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value) {
      throw new ServiceUnavailableException(`${name} is not configured`);
    }
    return value;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
