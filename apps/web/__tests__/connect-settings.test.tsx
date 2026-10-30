import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectSettings } from "../app/app/settings/connect-settings";
import { apiFetch, authorizedFetch } from "../app/lib/api-client";

jest.mock("../app/lib/api-client", () => ({
  apiFetch: jest.fn(),
  authorizedFetch: jest.fn()
}));
jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "en" })
}));

const apiFetchMock = apiFetch as jest.Mock;
const authorizedFetchMock = authorizedFetch as jest.Mock;

const connection = {
  id: "conn-1",
  name: "My Shop",
  baseUrl: "https://shop.test/api",
  keyId: "ck_abc",
  lastTestedAt: null,
  lastTestOk: false,
  previousSecretExpiresAt: null,
  suspendedAt: null
};

describe("ConnectSettings", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authorizedFetchMock.mockReset();
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it("generates a key and shows the secret once", async () => {
    apiFetchMock.mockResolvedValueOnce(null);
    render(<ConnectSettings />);

    fireEvent.change(await screen.findByLabelText("System name"), { target: { value: "My Shop" } });
    fireEvent.change(screen.getByLabelText("System URL"), {
      target: { value: "https://shop.test/api" }
    });
    apiFetchMock.mockResolvedValueOnce({ ...connection, secret: "cs_once" });
    fireEvent.click(screen.getByRole("button", { name: "Generate key" }));

    expect(await screen.findByText("cs_once")).toBeInTheDocument();
    expect(screen.getByText("ck_abc")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/v1/integrations/connection",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "My Shop", baseUrl: "https://shop.test/api" })
      })
    );
  });

  it("does not show a secret for an existing connection", async () => {
    apiFetchMock.mockResolvedValueOnce(connection);
    render(<ConnectSettings />);

    expect(await screen.findByText("ck_abc")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-secret")).not.toBeInTheDocument();
  });

  it("marks the connection verified after a passed test", async () => {
    apiFetchMock.mockResolvedValueOnce(connection);
    render(<ConnectSettings />);
    expect(await screen.findByText(/Not tested yet/)).toBeInTheDocument();

    apiFetchMock.mockResolvedValueOnce({ ok: true, signatureEnforced: true, errorCode: null });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText(/Test passed/)).toBeInTheDocument();
  });

  it("explains when the system does not verify signatures", async () => {
    apiFetchMock.mockResolvedValueOnce(connection);
    render(<ConnectSettings />);
    await screen.findByText("ck_abc");

    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      signatureEnforced: false,
      errorCode: "CONNECT_SIGNATURE_NOT_ENFORCED"
    });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("accepted an invalid signature");
  });

  it("disconnects after confirmation and returns to the form", async () => {
    apiFetchMock.mockResolvedValueOnce(connection);
    authorizedFetchMock.mockResolvedValue({ ok: true });
    render(<ConnectSettings />);
    await screen.findByText("ck_abc");

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(screen.getByLabelText("System name")).toBeInTheDocument());
    expect(authorizedFetchMock).toHaveBeenCalledWith("/api/v1/integrations/connection", {
      method: "DELETE"
    });
  });
});
