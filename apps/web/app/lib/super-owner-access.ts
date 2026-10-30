import { authorizedFetch } from "./api-client";

export type SuperOwnerAccess = "allowed" | "denied" | "two-fa-required";

/**
 * Only a clear refusal denies access. A server error or network failure says
 * nothing about the session, so it must not send a signed-in owner to the login
 * page. The API still enforces access on every call, and each page shows its own
 * load errors.
 */
export async function checkSuperOwnerAccess(): Promise<SuperOwnerAccess> {
  try {
    const response = await authorizedFetch("/api/v1/super-admin/backups/health");
    if (response.status === 401) {
      return "denied";
    }
    if (response.status === 403) {
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      return body?.error?.code === "SUPER_OWNER_2FA_REQUIRED" ? "two-fa-required" : "denied";
    }
    return "allowed";
  } catch {
    return "allowed";
  }
}
