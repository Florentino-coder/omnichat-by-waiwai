import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TermwaiClient } from "./termwai.client";

const createClient = (baseUrl?: string): TermwaiClient =>
  new TermwaiClient({ get: () => baseUrl } as unknown as ConfigService);

const statusOf = async (promise: Promise<unknown>): Promise<number> => {
  const error = await promise.catch((caught: unknown) => caught);
  return (error as HttpException).getStatus();
};

describe("TermwaiClient", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends the key in a header, refuses redirects, and unwraps data", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { customers: [{ id: "c1" }] } }))
    );

    const customers = await createClient("https://termwai.test/").lookupCustomers(
      "twchat_key",
      "081 234"
    );

    expect(customers).toEqual([{ id: "c1" }]);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://termwai.test/api/integrations/chat/customers/lookup?phone=081%20234");
    expect(url).not.toContain("twchat_key");
    expect(options.redirect).toBe("error");
    expect(options.headers).toMatchObject({ "X-Api-Key": "twchat_key" });
  });

  it("encodes the order number into the path", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { order: {} } })));
    await createClient().getOrder("key", "GT/../x");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.termwai.in.th/api/integrations/chat/orders/GT%2F..%2Fx"
    );
  });

  it.each([
    [401, 422],
    [403, 422],
    [400, 400],
    [404, 404],
    [429, 429],
    [500, 502]
  ])("maps upstream status %i to %i", async (upstream, expected) => {
    fetchMock.mockResolvedValue(new Response("{}", { status: upstream }));
    await expect(statusOf(createClient().ping("key"))).resolves.toBe(expected);
  });

  it("returns 502 without leaking details when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1"));
    const error = (await createClient()
      .ping("key")
      .catch((caught: unknown) => caught)) as HttpException;
    expect(error.getStatus()).toBe(502);
    expect(JSON.stringify(error.getResponse())).not.toContain("10.0.0.1");
  });
});
