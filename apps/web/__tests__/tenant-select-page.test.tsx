import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TenantSelectPage from "../app/(auth)/tenant-select/page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  })
}));

describe("TenantSelectPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("renders memberships and switches the active tenant workspace", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "user-1",
            email: "owner@omnichat.local",
            displayName: "Owner",
            role: "OWNER"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              membershipId: "member-1",
              tenantId: "tenant-1",
              tenantName: "Jinbao",
              tenantSlug: "jinbao",
              tenantLogoUrl: null,
              workspaceId: "workspace-1",
              workspaceName: "Sales",
              isDefaultWorkspace: true,
              role: "OWNER"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: {
              id: "user-1",
              email: "owner@omnichat.local",
              displayName: "Owner",
              tenantId: "tenant-1",
              workspaceId: "workspace-1",
              role: "OWNER"
            }
          }
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<TenantSelectPage />);

    expect(await screen.findByText("Jinbao")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use Jinbao Sales" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/switch-tenant", {
        body: JSON.stringify({ workspaceId: "workspace-1" }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
    expect(window.localStorage.getItem("omnichat.accessToken")).toBeNull();
    expect(window.localStorage.getItem("omnichat.refreshToken")).toBeNull();
    expect(window.localStorage.getItem("omnichat.user")).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/app/inbox");
  });
});
