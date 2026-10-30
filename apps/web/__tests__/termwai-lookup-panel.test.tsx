import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TermwaiLookupPanel } from "../components/inbox/TermwaiLookupPanel";
import { apiFetch } from "../app/lib/api-client";

jest.mock("../app/lib/api-client", () => ({
  apiFetch: jest.fn()
}));
jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "en" })
}));

const apiFetchMock = apiFetch as jest.Mock;

const respond = (lookup: unknown) => {
  apiFetchMock.mockImplementation(async (path: string) =>
    path === "/api/v1/integrations/termwai" ? { connected: true } : lookup
  );
};

const customer = {
  id: "c1",
  username: "somchai",
  phoneMasked: "***5678",
  emailMasked: "so***@example.com",
  recentOrders: [
    {
      orderNumber: "GT123456",
      status: "completed",
      paymentStatus: "paid",
      total: 100,
      createdAt: "2026-10-01T00:00:00.000Z",
      items: [{ productName: "Diamonds", quantity: 1 }]
    }
  ],
  recentDeposits: [
    { reference: "DEP1", amount: 500, status: "pending", createdAt: "2026-10-02T00:00:00.000Z" }
  ]
};

describe("TermwaiLookupPanel", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("renders nothing when Termwai is not connected", async () => {
    apiFetchMock.mockResolvedValue({ connected: false });
    render(<TermwaiLookupPanel phone="0812345678" />);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(screen.queryByTestId("termwai-lookup-panel")).not.toBeInTheDocument();
  });

  it("renders nothing when the role has no access", async () => {
    apiFetchMock.mockRejectedValue(new Error("Forbidden"));
    render(<TermwaiLookupPanel />);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(screen.queryByTestId("termwai-lookup-panel")).not.toBeInTheDocument();
  });

  it("does not search until the agent asks, then shows a phone result", async () => {
    respond([customer]);
    render(<TermwaiLookupPanel phone="0812345678" />);
    const button = await screen.findByRole("button", { name: "Search" });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(button);

    expect(await screen.findByText("somchai")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/v1/integrations/termwai/customers?phone=0812345678"
    );
    expect(screen.getByText("GT123456")).toBeInTheDocument();
    expect(screen.getByText("฿500")).toBeInTheDocument();
    expect(screen.getByText(/Verify identity/)).toBeInTheDocument();
  });

  it("searches by order when the query has letters", async () => {
    respond({ order: customer.recentOrders[0], customer: null });
    render(<TermwaiLookupPanel />);
    const input = await screen.findByLabelText("Phone or order number");

    fireEvent.change(input, { target: { value: "GT123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("GT123456")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/v1/integrations/termwai/orders/GT123456");
  });

  it("shows empty and error states", async () => {
    respond([]);
    render(<TermwaiLookupPanel phone="0812345678" />);
    fireEvent.click(await screen.findByRole("button", { name: "Search" }));
    expect(await screen.findByText("Nothing found in Termwai")).toBeInTheDocument();

    apiFetchMock.mockRejectedValue(new Error("Could not reach Termwai. Try again."));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach Termwai");
  });
});
