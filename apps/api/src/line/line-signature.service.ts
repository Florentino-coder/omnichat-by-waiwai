import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

@Injectable()
export class LineSignatureService {
  verify(rawBody: Buffer, signature: string | undefined, channelSecret: string): boolean {
    if (!signature) {
      return false;
    }

    const expected = createHmac("sha256", channelSecret).update(rawBody).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, "base64");
    } catch {
      return false;
    }

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

