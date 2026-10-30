import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResetPasswordForm } from "../app/(auth)/reset-password/reset-password-form";

describe("ResetPasswordForm", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("asks for a new link when the token is missing", () => {
    render(<ResetPasswordForm token="" />);
    expect(screen.getByRole("alert")).toHaveTextContent("missing its token");
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("submits the token with the new password", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ResetPasswordForm token="abc123" />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "NewPassword123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Password updated"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "abc123", newPassword: "NewPassword123!" })
      })
    );
  });

  it("shows the API error for an expired link", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Reset link is invalid or has expired" } })
    }) as unknown as typeof fetch;

    render(<ResetPasswordForm token="expired" />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "NewPassword123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Reset link is invalid or has expired")
    );
  });
});
