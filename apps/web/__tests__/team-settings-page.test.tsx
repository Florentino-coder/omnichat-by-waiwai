import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TeamSettingsPage from "../app/app/settings/team/page";

jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "en", setLocale: () => {} }),
  LanguageProvider: ({ children }: any) => <>{children}</>
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() })
}));

describe("TeamSettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("omnichat.accessToken", "access-token");
    window.localStorage.setItem(
      "omnichat.user",
      JSON.stringify({
        id: "user-1",
        email: "admin@omnichat.local",
        displayName: "Admin",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: "ADMIN"
      })
    );
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("lists team members and creates an invitation for the selected workspace", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "workspace-1", name: "Sales", isDefault: true }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "member-1",
              userId: "user-1",
              role: "ADMIN",
              isActive: true,
              user: { email: "admin@omnichat.local", displayName: "Admin" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "invite-1" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "invite-1",
              email: "agent@omnichat.local",
              role: "AGENT",
              status: "PENDING",
              workspaceId: "workspace-1",
              token: "token-1"
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<TeamSettingsPage />);

    expect(await screen.findByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@omnichat.local")).toBeInTheDocument();
    const inviteRoleSelect = screen.getByLabelText("Invite role");
    expect(inviteRoleSelect.querySelector('option[value="OWNER"]')).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Invite email"), {
      target: { value: "agent@omnichat.local" }
    });
    fireEvent.change(screen.getByLabelText("Invite role"), {
      target: { value: "AGENT" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/invitations", {
        body: JSON.stringify({
          workspaceId: "workspace-1",
          email: "agent@omnichat.local",
          role: "AGENT"
        }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
    expect(await screen.findByText("agent@omnichat.local")).toBeInTheDocument();
  });
});
