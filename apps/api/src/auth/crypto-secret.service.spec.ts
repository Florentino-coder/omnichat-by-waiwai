import { ConfigService } from "@nestjs/config";
import { CryptoSecretService } from "./crypto-secret.service";

const validKey = Buffer.alloc(32, 7).toString("base64");

const createService = (key: string | undefined): CryptoSecretService => {
  const config = {
    get: (name: string): string | undefined =>
      name === "ENCRYPTION_KEY" ? key : undefined
  };
  return new CryptoSecretService(config as ConfigService);
};

describe("CryptoSecretService", () => {
  it("encrypts without plaintext and decrypts roundtrip", () => {
    const service = createService(validKey);

    const encrypted = service.encrypt("totp-secret");

    expect(encrypted).not.toContain("totp-secret");
    expect(service.decrypt(encrypted)).toBe("totp-secret");
  });

  it("throws configuration error for invalid keys", () => {
    expect(() => createService(undefined).encrypt("secret")).toThrow(
      "ENCRYPTION_KEY must be a 32-byte base64 value"
    );
    expect(() => createService("too-short").encrypt("secret")).toThrow(
      "ENCRYPTION_KEY must be a 32-byte base64 value"
    );
  });
});
