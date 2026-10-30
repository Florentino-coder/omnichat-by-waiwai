import * as bcrypt from "bcryptjs";
import { createSuperOwner } from "./super-owner-create";

const createPrisma = (existing: { id: string } | null = null) => ({
  user: {
    findFirst: jest.fn().mockResolvedValue(existing),
    create: jest.fn(async ({ data }: { data: { email: string; username: string | null } }) => ({
      id: "owner-1",
      email: data.email,
      username: data.username
    }))
  }
});

const input = {
  email: " Owner@Example.com ",
  username: " Owners ",
  password: "NewPassword123!",
  displayName: " Owners "
};

describe("createSuperOwner", () => {
  it("creates a verified Super Owner with lowercase login names and a hashed password", async () => {
    const prisma = createPrisma();

    await expect(createSuperOwner(prisma, input)).resolves.toEqual({
      id: "owner-1",
      email: "owner@example.com",
      username: "owners"
    });

    const { data } = prisma.user.create.mock.calls[0][0] as unknown as {
      data: { passwordHash: string } & Record<string, unknown>;
    };
    expect(data).toMatchObject({
      email: "owner@example.com",
      username: "owners",
      displayName: "Owners",
      isSuperOwner: true,
      emailVerified: true
    });
    await expect(bcrypt.compare("NewPassword123!", data.passwordHash)).resolves.toBe(true);
  });

  it("leaves the username empty when none is given", async () => {
    const prisma = createPrisma();
    const result = await createSuperOwner(prisma, { ...input, username: undefined });

    expect(result.username).toBeNull();
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: "owner@example.com" }] },
      select: { id: true }
    });
  });

  it("refuses when the email or username is taken, including a username used as an email", async () => {
    const prisma = createPrisma({ id: "someone" });

    await expect(createSuperOwner(prisma, input)).rejects.toThrow("already exists");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: "owner@example.com" }, { username: "owners" }, { email: "owners" }]
      },
      select: { id: true }
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it.each([
    ["an invalid email", { email: "owners" }, "Email is invalid"],
    ["a short username", { username: "ab" }, "Username must be"],
    ["a username with spaces", { username: "my owner" }, "Username must be"],
    ["a short password", { password: "short" }, "at least 8"]
  ])("refuses %s before touching the database", async (_name, override, message) => {
    const prisma = createPrisma();

    await expect(createSuperOwner(prisma, { ...input, ...override })).rejects.toThrow(message);

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
