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

  it("still offers the setup key if the QR code fails", async () => {
    toDataUrlMock.mockRejectedValue(new Error("too long"));
    render(<SuperAdminSecurityPage />);

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));

    expect(await screen.findByTestId("totp-secret")).toHaveTextContent("TESTSECRET");
    await waitFor(() => expect(toDataUrlMock).toHaveBeenCalled());
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
