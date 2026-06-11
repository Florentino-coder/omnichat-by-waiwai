import { User, WorkspaceMember } from "@prisma/client";

export type SafeUserProfile = Pick<
  User,
  | "id"
  | "email"
  | "displayName"
  | "avatarUrl"
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
