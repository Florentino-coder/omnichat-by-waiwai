import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AppLayout from "../app/app/layout";
import SettingsPage from "../app/app/settings/page";

describe("App shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("omnichat.accessToken", "access-token");
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("renders icon rail, enabled inbox nav, disabled future nav, and settings content", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] })
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(
      <AppLayout>
        <SettingsPage />
      </AppLayout>
    );

    const nav = screen.getByLabelText("Primary");
    expect(nav).toHaveClass("w-14");

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "href",
      "/app/inbox"
    );
    expect(screen.getAllByRole("link", { name: "Settings" })[0]).toHaveAttribute(
      "href",
      "/app/settings"
    );

    for (const label of ["Customers", "Reports", "Knowledge"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: "Customers" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reports" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Knowledge" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(await screen.findByText("No LINE channel connected yet.")).toBeInTheDocument();
  });

  it("posts LINE channel settings from the settings page", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "workspace-1",
              name: "Default Workspace",
              isDefault: true
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
        json: async () => ({ success: true, data: { id: "line-channel-1" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "line-channel-1",
              name: "Main LINE OA",
              badgeColor: "#0ea5e9",
              lineChannelId: "1234567890",
              workspaceId: "workspace-1",
              createdAt: "2026-06-14T01:02:00.000Z"
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<SettingsPage />);

    expect(await screen.findByText("Default Workspace")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Channel name"), {
      target: { value: "Main LINE OA" }
    });
    fireEvent.change(screen.getByLabelText("LINE channel ID"), {
      target: { value: "1234567890" }
    });
    fireEvent.change(screen.getByLabelText("Channel secret"), {
      target: { value: "line-secret-value" }
    });
    fireEvent.change(screen.getByLabelText("Channel access token"), {
      target: { value: "line-access-token-value" }
    });
    fireEvent.change(screen.getByLabelText("Badge color"), {
      target: { value: "#0ea5e9" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Add LINE OA channel" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/channels", {
        body: JSON.stringify({
          channelAccessToken: "line-access-token-value",
          channelSecret: "line-secret-value",
          badgeColor: "#0ea5e9",
          lineChannelId: "1234567890",
          name: "Main LINE OA",
          workspaceId: "workspace-1"
        }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/workspaces", {
      headers: { Authorization: "Bearer access-token" }
    });
    expect(await screen.findByText("LINE channel saved. Webhook ready for production test.")).toBeInTheDocument();
    expect(
      await screen.findByText(`${window.location.origin}/api/v1/line/webhook/1234567890`)
    ).toBeInTheDocument();
  });

  it("keeps the LINE settings form ready for adding multiple OA channels", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "workspace-1",
              name: "Default Workspace",
              isDefault: true
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "line-channel-1",
              name: "Line OA 1",
              badgeColor: "#4f46e5",
              lineChannelId: "1111111111",
              workspaceId: "workspace-1",
              createdAt: "2026-06-14T01:02:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "line-channel-2" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "line-channel-1",
              name: "Line OA 1",
              badgeColor: "#4f46e5",
              lineChannelId: "1111111111",
              workspaceId: "workspace-1",
              createdAt: "2026-06-14T01:02:00.000Z"
            },
            {
              id: "line-channel-2",
              name: "Line OA 2",
              badgeColor: "#16a34a",
              lineChannelId: "2222222222",
              workspaceId: "workspace-1",
              createdAt: "2026-06-14T01:03:00.000Z"
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<SettingsPage />);

    expect(await screen.findByDisplayValue("Line OA 2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("LINE channel ID"), {
      target: { value: "2222222222" }
    });
    fireEvent.change(screen.getByLabelText("Channel secret"), {
      target: { value: "line-secret-two" }
    });
    fireEvent.change(screen.getByLabelText("Channel access token"), {
      target: { value: "line-access-token-two" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Add LINE OA channel" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/channels", {
        body: JSON.stringify({
          channelAccessToken: "line-access-token-two",
          channelSecret: "line-secret-two",
          badgeColor: "#4f46e5",
          lineChannelId: "2222222222",
          name: "Line OA 2",
          workspaceId: "workspace-1"
        }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
    expect(await screen.findByText("2 connected")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Line OA 3")).toBeInTheDocument();
  });
});
