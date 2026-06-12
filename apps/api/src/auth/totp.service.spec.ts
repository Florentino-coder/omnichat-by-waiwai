jest.mock("otplib", () => ({
  OTP: class {
    generateSecret(): string {
      return "MOCKSECRET123456";
    }

    generateSync(): string {
      return "123456";
    }

    verifySync(options: { token: string }): { valid: boolean } {
      return { valid: options.token === "123456" };
    }

    generateURI(options: { issuer: string; label: string; secret: string }): string {
      return `otpauth://totp/${options.issuer}:${options.label}?secret=${options.secret}&issuer=${options.issuer}`;
    }
  }
}));

import { TotpService } from "./totp.service";

describe("TotpService", () => {
  it("generates otpauth setup uri with OmniChat issuer", () => {
    const service = new TotpService();

    const setup = service.generateSetup("owner@omnichat.test");

    expect(setup.secret.length).toBeGreaterThan(10);
    expect(setup.otpauthUri).toContain("otpauth://");
    expect(setup.otpauthUri).toContain("issuer=OmniChat");
  });

  it("verifies valid codes and rejects invalid or missing codes", () => {
    const service = new TotpService();

    expect(service.verify("MOCKSECRET123456", "123456")).toBe(true);
    expect(service.verify("MOCKSECRET123456", "000000")).toBe(false);
    expect(service.verify("MOCKSECRET123456", undefined)).toBe(false);
  });
});
