import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AcceptInvitePage from "../app/invite/accept/page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  }),
  useSearchParams: () => new URLSearchParams("token=invite-token")
}));

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("verifies invitation token and accepts the invite", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            email: "agent@omnichat.local",
            role: "AGENT",
            tenant: { name: "Jinbao" },
            workspace: { name: "Sales" }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "user-2" } })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<AcceptInvitePage />);

    expect(await screen.findByText("Jinbao")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Agent One" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "ChangeMe123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Join workspace" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/invitations/accept/invite-token", {
        body: JSON.stringify({
          displayName: "Agent One",
          password: "ChangeMe123!"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
