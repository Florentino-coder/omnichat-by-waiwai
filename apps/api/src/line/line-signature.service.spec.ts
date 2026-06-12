import { createHmac } from "crypto";
import { LineSignatureService } from "./line-signature.service";

describe("LineSignatureService", () => {
  it("accepts a valid LINE HMAC signature", () => {
    const service = new LineSignatureService();
    const body = Buffer.from('{"events":[]}');
    const signature = createHmac("sha256", "channel-secret")
      .update(body)
      .digest("base64");

    expect(service.verify(body, signature, "channel-secret")).toBe(true);
  });

  it("rejects an invalid LINE HMAC signature", () => {
    const service = new LineSignatureService();

    expect(
      service.verify(Buffer.from('{"events":[]}'), "bad-signature", "channel-secret")
    ).toBe(false);
  });
});

