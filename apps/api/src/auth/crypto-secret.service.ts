import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

@Injectable()
export class CryptoSecretService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, ciphertext].map((part) => part.toString("base64")).join(".");
  }

  decrypt(encrypted: string): string {
    const [ivValue, tagValue, ciphertextValue] = encrypted.split(".");
    if (!ivValue || !tagValue || !ciphertextValue) {
      throw new InternalServerErrorException("Encrypted secret is invalid");
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key(),
      Buffer.from(ivValue, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64")),
      decipher.final()
    ]).toString("utf8");
  }

  private key(): Buffer {
    const value = this.configService.get<string>("ENCRYPTION_KEY");
    const key = value ? Buffer.from(value, "base64") : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        "ENCRYPTION_KEY must be a 32-byte base64 value"
      );
    }
    return key;
  }
}
