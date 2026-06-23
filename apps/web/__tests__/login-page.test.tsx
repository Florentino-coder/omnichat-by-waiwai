import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../app/(auth)/login/page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  })
}));

describe("LoginPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("signs in via BFF, keeps tokens out of localStorage, and opens tenant select", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: "user-1",
            email: "owner@omnichat.local",
            displayName: "Test Owner",
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

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "owner@omnichat.local" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "ChangeMe123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/login", {
        body: JSON.stringify({
          email: "owner@omnichat.local",
          password: "ChangeMe123!"
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    });

    expect(window.localStorage.getItem("omnichat.accessToken")).toBeNull();
    expect(window.localStorage.getItem("omnichat.refreshToken")).toBeNull();
    expect(window.localStorage.getItem("omnichat.user")).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/tenant-select");
  });

  it("shows the API error when credentials are rejected", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message: "Invalid email or password"
      })
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "owner@omnichat.local" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
