import { BadRequestException } from "@nestjs/common";
import {
  assertResolvesToPublicAddress,
  assertSafePublicUrl,
  fetchPublicUrlText
} from "./knowledge-url.util";

describe("assertSafePublicUrl", () => {
  it("accepts public https URLs", () => {
    const parsed = assertSafePublicUrl("https://example.com/docs/policy");
    expect(parsed.hostname).toBe("example.com");
  });

  it("rejects localhost", () => {
    expect(() => assertSafePublicUrl("http://localhost/page")).toThrow(BadRequestException);
  });

  it("rejects private IPv4", () => {
    expect(() => assertSafePublicUrl("http://192.168.1.10/internal")).toThrow(
      BadRequestException
    );
  });

  it("rejects non-http protocols", () => {
    expect(() => assertSafePublicUrl("file:///etc/passwd")).toThrow(BadRequestException);
  });

  it("rejects invalid URLs", () => {
    expect(() => assertSafePublicUrl("not-a-url")).toThrow(BadRequestException);
  });

  it.each([
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://[fd00::1]/",
    "https://[fe80::1]/",
    "https://100.64.0.1/",
    "https://169.254.169.254/latest/meta-data",
    "https://0.0.0.1/",
    "https://metadata.google.internal/"
  ])("rejects internal address %s", (url) => {
    expect(() => assertSafePublicUrl(url)).toThrow(BadRequestException);
  });
});

describe("assertResolvesToPublicAddress", () => {
  it("rejects hosts that resolve to a private address", async () => {
    await expect(
      assertResolvesToPublicAddress(new URL("https://evil.example"), async () => [
        "93.184.216.34",
        "10.0.0.5"
      ])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects hosts that cannot be resolved", async () => {
    await expect(
      assertResolvesToPublicAddress(new URL("https://missing.example"), async () => {
        throw new Error("ENOTFOUND");
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts hosts that resolve only to public addresses", async () => {
    await expect(
      assertResolvesToPublicAddress(new URL("https://example.com"), async () => [
        "93.184.216.34"
      ])
    ).resolves.toBeUndefined();
  });
});

describe("fetchPublicUrlText", () => {
  const publicResolver = async (): Promise<string[]> => ["93.184.216.34"];
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the body of a public page", async () => {
    fetchMock.mockResolvedValue(new Response("<html>ok</html>", { status: 200 }));
    await expect(fetchPublicUrlText("https://example.com", publicResolver)).resolves.toBe(
      "<html>ok</html>"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({ redirect: "manual" })
    );
  });

  it("rejects redirects to internal addresses", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://169.254.169.254/latest/meta-data" }
      })
    );
    await expect(
      fetchPublicUrlText("https://example.com", publicResolver)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-resolves the host on every redirect hop", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 301, headers: { location: "https://rebind.example/" } })
    );
    const resolver = jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValueOnce(["93.184.216.34"])
      .mockResolvedValueOnce(["10.0.0.5"]);

    await expect(fetchPublicUrlText("https://example.com", resolver)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(resolver).toHaveBeenLastCalledWith("rebind.example");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(null, { status: 302, headers: { location: "https://example.com/loop" } })
    );
    await expect(
      fetchPublicUrlText("https://example.com", publicResolver)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("rejects bodies larger than 5MB even without content-length", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 6; i += 1) {
          controller.enqueue(chunk);
        }
        controller.close();
      }
    });
    fetchMock.mockResolvedValue(new Response(stream, { status: 200 }));
    await expect(
      fetchPublicUrlText("https://example.com", publicResolver)
    ).rejects.toThrow("Response size exceeds limit (5MB)");
  });
});
