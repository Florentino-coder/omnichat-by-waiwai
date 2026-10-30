import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SuperAdminIntegrationsPage from "../app/super-admin/integrations/page";
import { apiFetch } from "../app/lib/api-client";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() })
}));
jest.mock("../app/lib/api-client", () => ({
  apiFetch: jest.fn()
}));
jest.mock("../app/lib/use-super-owner-gate", () => ({
  useSuperOwnerGate: () => ({ isLoading: false, isReady: true, isDenied: false })
}));

const apiFetchMock = apiFetch as jest.Mock;

const row = {
  id: "conn-1",
  tenantName: "Acme",
  planId: "pro",
  name: "Acme Shop",
  baseUrl: "https://acme.test/api",
  keyId: "ck_1",
  lastTestedAt: null,
  lastTestOk: true,
  suspendedAt: null,
  suspendedReason: null,
  deletedAt: null,
  lookupsThisMonth: 12
};

describe("SuperAdminIntegrationsPage", () => {
  beforeEach(() => apiFetchMock.mockReset());
  afterEach(() => jest.restoreAllMocks());

  it("lists connections with status and usage", async () => {
    apiFetchMock.mockResolvedValue([row]);
    render(<SuperAdminIntegrationsPage />);

    expect(await screen.findByText("Acme Shop")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    apiFetchMock.mockResolvedValue([]);
    render(<SuperAdminIntegrationsPage />);
    expect(await screen.findByText(/No tenant has connected/)).toBeInTheDocument();
  });

  it("suspends only after a reason is given", async () => {
    apiFetchMock.mockResolvedValue([row]);
    const prompt = jest.spyOn(window, "prompt").mockReturnValueOnce("");
    render(<SuperAdminIntegrationsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Suspend" }));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    prompt.mockReturnValueOnce(" Key leaked ");
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/super-admin/integrations/conn-1/suspend", {
        method: "POST",
        body: JSON.stringify({ reason: "Key leaked" })
      })
    );
  });

  it("resumes a suspended connection after confirmation", async () => {
    apiFetchMock.mockResolvedValue([
      { ...row, suspendedAt: "2026-10-31T00:00:00.000Z", suspendedReason: "Key leaked", deletedAt: "2026-10-31T01:00:00.000Z" }
    ]);
    jest.spyOn(window, "confirm").mockReturnValue(true);
    render(<SuperAdminIntegrationsPage />);

    expect(await screen.findByText("Key leaked")).toBeInTheDocument();
    expect(screen.getByText("Disconnected by tenant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/super-admin/integrations/conn-1/resume", {
        method: "POST",
        body: undefined
      })
    );
  });

  it("never renders secret fields", async () => {
    apiFetchMock.mockResolvedValue([row]);
    const { container } = render(<SuperAdminIntegrationsPage />);
    await screen.findByText("Acme Shop");
    expect(container.textContent).not.toMatch(/cs_|encrypted/);
  });
});
