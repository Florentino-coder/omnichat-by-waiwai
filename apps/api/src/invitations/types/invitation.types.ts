import { Invitation, Tenant, Workspace } from "@prisma/client";

export type InvitationWithContext = Invitation & {
  tenant: Pick<Tenant, "id" | "name" | "slug">;
  workspace: Pick<Workspace, "id" | "name">;
};

export interface CreatedInvitationResponse {
  invitation: Invitation;
  inviteToken: string;
  inviteUrl: string;
}
