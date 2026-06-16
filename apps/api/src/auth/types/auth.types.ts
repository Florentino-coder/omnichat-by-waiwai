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

export interface TenantMembershipResponse {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl: string | null;
  workspaceId: string;
  workspaceName: string;
  isDefaultWorkspace: boolean;
  role: Role;
}

export interface RequestWithUser {
  user?: JwtTenantPayload;
}
