import { User, WorkspaceMember } from "@prisma/client";

export type SafeUserProfile = Pick<
  User,
  | "id"
  | "email"
  | "displayName"
  | "avatarUrl"
  | "username"
  | "emailVerified"
  | "twoFaEnabled"
  | "lastLoginAt"
  | "isActive"
  | "createdAt"
  | "updatedAt"
> & {
  memberships: Pick<
    WorkspaceMember,
    "id" | "tenantId" | "workspaceId" | "role" | "isActive" | "joinedAt"
  >[];
};
