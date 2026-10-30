import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import QRCode from "qrcode";
import SuperAdminSecurityPage from "../app/super-admin/security/page";
import { apiFetch } from "../app/lib/api-client";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() })
}));
jest.mock("../app/lib/api-client", () => ({
  apiFetch: jest.fn(),
  authorizedFetch: jest.fn()
}));
jest.mock("../app/lib/use-auth-session", () => ({
  useAuthSession: () => ({
    user: { id: "owner-1", email: "o@x.co", displayName: "O", isSuperOwner: true, twoFaEnabled: false },
    isLoading: false,
    error: null
  })
}));
jest.mock("qrcode", () => ({
  __esModule: true,
  default: { toDataURL: jest.fn() }
}));

const apiFetchMock = apiFetch as jest.Mock;
const OTPAUTH_URI = "otpauth://totp/ChatWai:o?secret=TESTSECRET&issuer=ChatWai";
const toDataUrlMock = QRCode.toDataURL as unknown as jest.Mock;

describe("SuperAdminSecurityPage", () => {
  beforeEach(() => {
    toDataUrlMock.mockReset();
    (apiFetch as jest.Mock).mockReset().mockResolvedValue({ otpauthUri: OTPAUTH_URI });
  });

  it("shows no QR code or key until setup starts", () => {
    render(<SuperAdminSecurityPage />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("totp-secret")).not.toBeInTheDocument();
    expect(toDataUrlMock).not.toHaveBeenCalled();
  });

  it("renders the QR code locally, alongside the setup key", async () => {
    toDataUrlMock.mockResolvedValue("data:image/png;base64,QR");
    render(<SuperAdminSecurityPage />);

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));

    const image = await screen.findByRole("img", { name: /QR code/ });
    expect(image).toHaveAttribute("src", "data:image/png;base64,QR");
    expect(toDataUrlMock.mock.calls[0][0]).toBe(OTPAUTH_URI);
    expect(screen.getByTestId("totp-secret")).toHaveTextContent("TESTSECRET");
  });

  const startAndEnterCode = async (): Promise<void> => {
    toDataUrlMock.mockResolvedValue("data:image/png;base64,QR");
    render(<SuperAdminSecurityPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
    fireEvent.change(await screen.findByLabelText("2. Enter the 6-digit code"), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor authentication" }));
  };

  it("verifies through apiFetch, which sends the JSON content type", async () => {
    apiFetchMock.mockReset().mockResolvedValueOnce({ otpauthUri: OTPAUTH_URI }).mockRejectedValueOnce(new Error("stop"));

    await startAndEnterCode();

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenLastCalledWith("/api/v1/auth/2fa/super-owner/verify", {
        method: "POST",
        body: JSON.stringify({ code: "123456" })
      })
    );
  });

  it("explains a wrong code and stays on the page", async () => {
    apiFetchMock
      .mockReset()
      .mockResolvedValueOnce({ otpauthUri: OTPAUTH_URI })
      .mockRejectedValueOnce(new Error("Invalid two-factor code"));

    await startAndEnterCode();

    expect(await screen.findByRole("alert")).toHaveTextContent("newest ChatWai entry");
  });

  it("shows other failures as they are, not as a wrong code", async () => {
    apiFetchMock
      .mockReset()
      .mockResolvedValueOnce({ otpauthUri: OTPAUTH_URI })
      .mockRejectedValueOnce(new Error("Too many requests"));

    await startAndEnterCode();

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
  });

  it("still offers the setup key if the QR code fails", async () => {
    toDataUrlMock.mockRejectedValue(new Error("too long"));
    render(<SuperAdminSecurityPage />);

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));

    expect(await screen.findByTestId("totp-secret")).toHaveTextContent("TESTSECRET");
    await waitFor(() => expect(toDataUrlMock).toHaveBeenCalled());
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
