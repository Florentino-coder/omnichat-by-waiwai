import { apiFetch } from "./api-client";

export async function verifySuperOwnerAccess(): Promise<boolean> {
  try {
    await apiFetch("/api/v1/admin/monitor/stats");
    return true;
  } catch {
    return false;
  }
}
