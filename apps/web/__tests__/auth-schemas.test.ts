import { forgotPasswordSchema, loginSchema } from "../lib/schemas/auth";

describe("auth schemas", () => {
  it("accepts username instead of email", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "ChangeMe123!" }).success).toBe(true);
  });

  it("rejects empty username or email", () => {
    expect(loginSchema.safeParse({ email: "", password: "ChangeMe123!" }).success).toBe(false);
  });

  it("rejects short password", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "short" }).success).toBe(false);
  });

  it("accepts valid login shape", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "ChangeMe123!" }).success).toBe(true);
  });

  it("requires matching passwords for forgot password reset", () => {
    expect(
      forgotPasswordSchema.safeParse({
        identifier: "owner",
        email: "owner@example.com",
        newPassword: "ChangeMe123!",
        confirmPassword: "Mismatch123!"
      }).success
    ).toBe(false);
    expect(
      forgotPasswordSchema.safeParse({
        identifier: "owner",
        email: "owner@example.com",
        newPassword: "ChangeMe123!",
        confirmPassword: "ChangeMe123!"
      }).success
    ).toBe(true);
  });
});
