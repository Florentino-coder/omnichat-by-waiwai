import * as bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH } from "./super-owner-reset";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/;

type CreatePrisma = {
  user: {
    findFirst(args: {
      where: { OR: Array<{ email: string } | { username: string }> };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        email: string;
        username: string | null;
        passwordHash: string;
        displayName: string;
        isSuperOwner: true;
        emailVerified: true;
        emailVerifiedAt: Date;
      };
      select: { id: true; email: true; username: true };
    }): Promise<{ id: string; email: string; username: string | null }>;
  };
};

/** Login lowercases what the user types, so a username is stored lowercase to stay reachable. */
export async function createSuperOwner(
  prisma: CreatePrisma,
  input: { email: string; username?: string; password: string; displayName: string }
): Promise<{ id: string; email: string; username: string | null }> {
  const email = input.email.trim().toLowerCase();
  const username = input.username?.trim().toLowerCase() || null;

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Email is invalid");
  }
  if (username && !USERNAME_PATTERN.test(username)) {
    throw new Error("Username must be 3-30 letters, numbers, underscores, or hyphens");
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(username ? [{ username }, { email: username }] : [])] },
    select: { id: true }
  });
  if (existing) {
    throw new Error("A user with that email or username already exists");
  }

  return prisma.user.create({
    data: {
      email,
      username,
      passwordHash: await bcrypt.hash(input.password, 12),
      displayName: input.displayName.trim() || "Super Admin",
      isSuperOwner: true,
      emailVerified: true,
      emailVerifiedAt: new Date()
    },
    select: { id: true, email: true, username: true }
  });
}
