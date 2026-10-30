import * as bcrypt from "bcryptjs";
import { describeDatabaseHost, resetSuperOwnerPassword } from "./super-owner-reset";

const createPrisma = (found: { id: string } | null = { id: "owner-1" }) => ({
  user: {
    findFirst: jest.fn().mockResolvedValue(found),
    update: jest.fn().mockResolvedValue({})
  },
  refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) }
});

describe("resetSuperOwnerPassword", () => {
  it("only matches Super Owners, hashes the password, and revokes sessions", async () => {
    const prisma = createPrisma();

    await expect(
      resetSuperOwnerPassword(prisma, {
        email: " Owner@Example.com ",
        password: "NewPassword123!",
        resetTwoFa: false
      })
    ).resolves.toEqual({ userId: "owner-1" });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: "owner@example.com", isSuperOwner: true, deletedAt: null },
      select: { id: true }
    });
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.passwordHash).not.toBe("NewPassword123!");
    await expect(bcrypt.compare("NewPassword123!", data.passwordHash)).resolves.toBe(true);
    expect(data).not.toHaveProperty("twoFaEnabled");
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "owner-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it("clears 2FA only when asked", async () => {
    const prisma = createPrisma();

    await resetSuperOwnerPassword(prisma, {
      email: "owner@example.com",
      password: "NewPassword123!",
      resetTwoFa: true
    });

    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      twoFaEnabled: false,
      twoFaSecret: null
    });
  });

  it("refuses a non-Super-Owner or unknown email", async () => {
    const prisma = createPrisma(null);

    await expect(
      resetSuperOwnerPassword(prisma, {
        email: "agent@example.com",
        password: "NewPassword123!",
        resetTwoFa: false
      })
    ).rejects.toThrow("No Super Owner found");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses a short password before touching the database", async () => {
    const prisma = createPrisma();

    await expect(
      resetSuperOwnerPassword(prisma, {
        email: "owner@example.com",
        password: "short",
        resetTwoFa: false
      })
    ).rejects.toThrow("at least 8");
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("describeDatabaseHost", () => {
  it("shows the host without credentials", () => {
    expect(describeDatabaseHost("postgresql://user:secret@db.example.com:5432/app")).toBe(
      "db.example.com:5432"
    );
  });

  it("handles a missing or invalid URL", () => {
    expect(describeDatabaseHost(undefined)).toBe("unknown");
    expect(describeDatabaseHost("not a url")).toBe("unknown");
  });
});
