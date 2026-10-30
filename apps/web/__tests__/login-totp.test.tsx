import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "../app/(auth)/login/login-form";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

const respond = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe("LoginForm two-factor step", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    pushMock.mockReset();
  });

  const submitPassword = () => {
    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "owner" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  };

  it("explains when a signed-in account is not a Super Admin", async () => {
    window.history.pushState({}, "", "/login?notice=super-owner-required");
    render(<LoginForm />);
    expect(await screen.findByRole("status")).toHaveTextContent("Sign in with the Super Admin account");
    window.history.pushState({}, "", "/login");
  });

  it("does not show the code field until the API asks for it", () => {
    render(<LoginForm />);
    expect(screen.queryByLabelText("Authenticator code")).not.toBeInTheDocument();
  });

  it("asks for a code, then signs in with it", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        respond(401, { success: false, error: { message: "Two-factor code is required" } })
      )
      .mockResolvedValueOnce(
        respond(200, {
          success: true,
          data: { user: { id: "u1", email: "o@x.co", displayName: "O", isSuperOwner: true } }
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LoginForm />);
    submitPassword();

    const codeInput = await screen.findByLabelText("Authenticator code");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/super-admin"));
    const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string) as {
      totpCode?: string;
    };
    expect(body.totpCode).toBe("123456");
  });

  it("rejects a code of the wrong length without calling the API", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        respond(401, { success: false, error: { message: "Two-factor code is required" } })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LoginForm />);
    submitPassword();

    fireEvent.change(await screen.findByLabelText("Authenticator code"), {
      target: { value: "123" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText(/6-digit code/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
