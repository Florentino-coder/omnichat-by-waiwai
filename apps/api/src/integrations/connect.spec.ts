import { HttpException } from "@nestjs/common";
import { createHmac } from "crypto";
import { ConnectClient } from "./connect.client";
import {
  parseConnectCustomers,
  parseConnectOrderDetail
} from "./connect-response.util";
import { buildConnectHeaders, buildConnectSigningPayload } from "./connect-signature.util";
import { ConnectTransport, createSafeLookup } from "./connect-transport";

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("connect signature", () => {
  it("signs timestamp, method, path with query, and body hash", () => {
    expect(buildConnectSigningPayload("1700000000", "get", "/v1/health?a=1")).toBe(
      `1700000000.GET./v1/health?a=1.${EMPTY_SHA256}`
    );
  });

  it("produces a verifiable v1 signature with the key id and timestamp", () => {
    const url = new URL("https://shop.test/api/v1/customers/lookup?phone=0812345678");
    const headers = buildConnectHeaders("ck_1", ["cs_new"], url, "1700000000");

    const expected = createHmac("sha256", "cs_new")
      .update(`1700000000.GET./api/v1/customers/lookup?phone=0812345678.${EMPTY_SHA256}`)
      .digest("hex");

    expect(headers).toEqual({
      "X-ChatWai-Key-Id": "ck_1",
      "X-ChatWai-Timestamp": "1700000000",
      "X-ChatWai-Signature": `v1=${expected}`
    });
  });

  it("sends one signature per secret during rotation", () => {
    const headers = buildConnectHeaders("ck_1", ["new", "old"], new URL("https://shop.test/v1/health"));
    expect(headers["X-ChatWai-Signature"].split(",")).toHaveLength(2);
  });
});

describe("createSafeLookup", () => {
  const run = (addresses: Array<{ address: string; family: number }>, all = false) =>
    new Promise<{ error: Error | null; address: unknown; family?: number }>((resolve) => {
      createSafeLookup(async () => addresses)("shop.test", { all }, (error, address, family) =>
        resolve({ error, address, family })
      );
    });

  it("passes public addresses to the socket", async () => {
    await expect(run([{ address: "93.184.216.34", family: 4 }])).resolves.toEqual({
      error: null,
      address: "93.184.216.34",
      family: 4
    });
  });

  it("supports the all option used by Node connection racing", async () => {
    const addresses = [{ address: "93.184.216.34", family: 4 }];
    await expect(run(addresses, true)).resolves.toMatchObject({ error: null, address: addresses });
  });

  it.each(["10.0.0.5", "127.0.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"])(
    "blocks %s even when mixed with a public address",
    async (address) => {
      const result = await run([
        { address: "93.184.216.34", family: 4 },
        { address, family: address.includes(":") ? 6 : 4 }
      ]);
      expect(result.error?.message).toBe("URL host is not allowed");
    }
  );

  it("fails when nothing resolves", async () => {
    await expect(run([])).resolves.toMatchObject({ error: expect.any(Error) });
  });
});

describe("response parsing", () => {
  it("drops undocumented fields a merchant returns by mistake", () => {
    const [customer] = parseConnectCustomers({
      customers: [
        {
          id: "c1",
          displayName: "somchai",
          phoneMasked: "***5678",
          emailMasked: "so***@x.co",
          password: "secret-hash",
          balance: 9999,
          recentOrders: [
            {
              orderNumber: "GT1",
              status: "completed",
              paymentStatus: "paid",
              total: 100,
              activeKey: "SECRET-CODE",
              items: [{ name: "Diamonds", quantity: 1, uid: "game-uid" }]
            }
          ],
          recentDeposits: [
            { reference: "DEP1", amount: 500, status: "pending", slipImage: "slip.jpg" }
          ]
        }
      ]
    });

    const serialized = JSON.stringify(customer);
    for (const leak of ["secret-hash", "9999", "SECRET-CODE", "game-uid", "slip.jpg"]) {
      expect(serialized).not.toContain(leak);
    }
    expect(customer.recentOrders[0].items).toEqual([{ name: "Diamonds", quantity: 1 }]);
  });

  it("caps list sizes and text length", () => {
    const customers = parseConnectCustomers({
      customers: Array.from({ length: 20 }, () => ({ displayName: "x".repeat(1000) }))
    });
    expect(customers).toHaveLength(5);
    expect(customers[0].displayName).toHaveLength(200);
  });

  it("survives malformed data", () => {
    expect(parseConnectCustomers(null)).toEqual([]);
    expect(parseConnectCustomers({ customers: "nope" })).toEqual([]);
    expect(parseConnectOrderDetail({ order: 5 }).customer).toBeNull();
    expect(parseConnectOrderDetail({ order: { total: "100", createdAt: "bad" } }).order).toMatchObject({
      total: null,
      createdAt: null
    });
  });
});

describe("ConnectClient", () => {
  const target = { baseUrl: "https://shop.test/api/chatwai", keyId: "ck_1", secrets: ["cs_1"] };
  const respond = (status: number, body = "{}") =>
    jest.fn<ReturnType<ConnectTransport>, Parameters<ConnectTransport>>().mockResolvedValue({ status, body });

  it("calls the versioned path with signed headers and a size limit", async () => {
    const transport = respond(200, JSON.stringify({ data: { customers: [{ id: "c1" }] } }));

    const customers = await new ConnectClient(transport).lookupCustomers(target, "081 234");

    expect(customers[0].id).toBe("c1");
    const request = transport.mock.calls[0][0];
    expect(request.url.toString()).toBe(
      "https://shop.test/api/chatwai/v1/customers/lookup?phone=081%20234"
    );
    expect(request.headers["X-ChatWai-Key-Id"]).toBe("ck_1");
    expect(request.headers["X-ChatWai-Signature"]).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(JSON.stringify(request)).not.toContain("cs_1");
    expect(request.maxBytes).toBe(1024 * 1024);
  });

  it("encodes the order number into the path", async () => {
    const transport = respond(200, JSON.stringify({ data: { order: {} } }));
    await new ConnectClient(transport).getOrder(target, "GT/../x");
    expect(transport.mock.calls[0][0].url.pathname).toBe("/api/chatwai/v1/orders/GT%2F..%2Fx");
  });

  it.each([
    [401, 422],
    [403, 422],
    [400, 400],
    [404, 404],
    [429, 429],
    [302, 502],
    [500, 502]
  ])("maps merchant status %i to %i", async (upstream, expected) => {
    const error = await new ConnectClient(respond(upstream))
      .health(target)
      .catch((caught: unknown) => caught);
    expect((error as HttpException).getStatus()).toBe(expected);
  });

  it("rejects non-JSON success responses", async () => {
    const error = await new ConnectClient(respond(200, "<html>"))
      .health(target)
      .catch((caught: unknown) => caught);
    expect((error as HttpException).getStatus()).toBe(502);
  });

  it("does not leak network details", async () => {
    const transport = jest
      .fn<ReturnType<ConnectTransport>, Parameters<ConnectTransport>>()
      .mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1"));
    const error = (await new ConnectClient(transport)
      .health(target)
      .catch((caught: unknown) => caught)) as HttpException;
    expect(JSON.stringify(error.getResponse())).not.toContain("10.0.0.1");
  });

  it("detects whether the merchant enforces signatures", async () => {
    await expect(new ConnectClient(respond(401)).rejectsBadSignature(target)).resolves.toBe(true);
    await expect(new ConnectClient(respond(200)).rejectsBadSignature(target)).resolves.toBe(false);
  });
});
