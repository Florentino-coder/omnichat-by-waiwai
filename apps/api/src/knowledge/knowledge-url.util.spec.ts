import { BadRequestException } from "@nestjs/common";
import { assertSafePublicUrl } from "./knowledge-url.util";

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
});
