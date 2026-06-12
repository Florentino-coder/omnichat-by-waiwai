import { Injectable } from "@nestjs/common";
import { OTP } from "otplib";

export interface TotpSetup {
  secret: string;
  otpauthUri: string;
}

@Injectable()
export class TotpService {
  private readonly otp = new OTP({ strategy: "totp" });

  generateSetup(email: string): TotpSetup {
    const secret = this.otp.generateSecret();
    return {
      secret,
      otpauthUri: this.otp.generateURI({
        issuer: "OmniChat",
        label: email,
        secret
      })
    };
  }

  verify(secret: string, code: string | undefined): boolean {
    if (!code) {
      return false;
    }
    return this.otp.verifySync({
      secret,
      token: code,
      epochTolerance: [30, 30]
    }).valid;
  }
}
