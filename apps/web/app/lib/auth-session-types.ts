export type AuthSessionUser = {
  id: string;
  email: string;
  displayName: string;
  tenantId?: string;
  workspaceId?: string;
  role?: string;
  isSuperOwner?: boolean;
};

export type AuthTokensPayload = {
  accessToken: string;
  refreshToken: string;
};
