import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AppLayout from "../app/app/layout";
import SettingsPage from "../app/app/settings/page";

describe("App shell", () => {
  it("renders icon rail, enabled inbox nav, disabled future nav, and settings content", () => {
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

    for (const label of ["Customers", "Reports", "Knowledge", "Settings"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: "Customers" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Settings" })).not.toBeDisabled();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("posts LINE channel settings from the settings page", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("Workspace ID"), {
      target: { value: "workspace-1" }
    });
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

    fireEvent.click(screen.getByRole("button", { name: "Save LINE channel" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/channels", {
        body: JSON.stringify({
          channelAccessToken: "line-access-token-value",
          channelSecret: "line-secret-value",
          lineChannelId: "1234567890",
          name: "Main LINE OA",
          workspaceId: "workspace-1"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    });
    expect(screen.getByText("LINE channel saved. Webhook ready for production test.")).toBeInTheDocument();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });
});
