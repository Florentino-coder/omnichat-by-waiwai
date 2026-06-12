export interface InvitationEmailPayload {
  to: string;
  inviteToken: string;
  tenantName: string;
  workspaceName: string;
  expiresAt: Date;
}

export interface TokenEmailPayload {
  to: string;
  token: string;
  expiresAt?: Date;
}

export interface WelcomeEmailPayload {
  to: string;
  displayName: string;
}

export interface EmailSendPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  emails: {
    send(payload: EmailSendPayload): Promise<unknown>;
  };
}
