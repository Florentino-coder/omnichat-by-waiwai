import * as bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

type ResetPrisma = {
  user: {
    findFirst(args: {
      where: { email: string; isSuperOwner: true; deletedAt: null };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    update(args: {
      where: { id: string };
      data: { passwordHash: string; twoFaEnabled?: false; twoFaSecret?: null };
    }): Promise<unknown>;
  };
  refreshToken: {
    updateMany(args: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<unknown>;
  };
};

/**
 * Break-glass reset for someone with production database access. Only matches
 * Super Owner accounts, so it cannot be used to take over a tenant user.
 */
export async function resetSuperOwnerPassword(
  prisma: ResetPrisma,
  input: { email: string; password: string; resetTwoFa: boolean }
): Promise<{ userId: string }> {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const user = await prisma.user.findFirst({
    where: { email: input.email.trim().toLowerCase(), isSuperOwner: true, deletedAt: null },
    select: { id: true }
  });
  if (!user) {
    throw new Error("No Super Owner found with that email");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(input.password, 12),
      ...(input.resetTwoFa ? { twoFaEnabled: false as const, twoFaSecret: null } : {})
    }
  });
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  return { userId: user.id };
}

/**
 * Prisma reads .env itself, but only when the client is created. Load it first, so
 * the host the operator confirms is the database the script will really change.
 */
export function loadLocalEnv(): void {
  if (process.env.DATABASE_URL) {
    return;
  }
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the caller reports the missing DATABASE_URL.
  }
}

/** Shows only the host, so the operator can confirm the target without exposing credentials. */
export function describeDatabaseHost(databaseUrl: string | undefined): string {
  try {
    return new URL(databaseUrl ?? "").host || "unknown";
  } catch {
    return "unknown";
  }
}
