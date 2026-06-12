import { Role } from "@prisma/client";

export interface RefreshSessionMetadata {
  userId: string;
  tenantId: string;
  workspaceId: string;
  role: Role;
  expiresAt: string;
}
