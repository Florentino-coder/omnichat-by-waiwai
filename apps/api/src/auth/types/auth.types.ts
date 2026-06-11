import { Role } from "@prisma/client";

export interface JwtTenantPayload {
  sub: string;
  email: string;
  tenantId: string;
  workspaceId: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;
  workspaceId: string;
  role: Role;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: AuthUserResponse;
}

export interface RequestWithUser {
  user?: JwtTenantPayload;
}
