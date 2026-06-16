import { loginSchema } from "../lib/schemas/auth";

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
});
