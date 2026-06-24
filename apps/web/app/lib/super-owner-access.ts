import { apiFetch } from "./api-client";

export async function verifySuperOwnerAccess(): Promise<boolean> {
  try {
    await apiFetch("/api/v1/super-admin/backups/health");
    return true;
  } catch {
    return false;
  }
}
