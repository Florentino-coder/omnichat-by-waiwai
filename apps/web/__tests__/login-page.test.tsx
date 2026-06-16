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

  it("signs in, stores the session, and opens the inbox", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tokens: {
            accessToken: "access-token",
            refreshToken: "refresh-token"
          },
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
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    });

    expect(window.localStorage.getItem("omnichat.accessToken")).toBe("access-token");
    expect(window.localStorage.getItem("omnichat.refreshToken")).toBe("refresh-token");
    expect(JSON.parse(window.localStorage.getItem("omnichat.user") ?? "{}")).toMatchObject({
      email: "owner@omnichat.local",
      role: "OWNER"
    });
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
