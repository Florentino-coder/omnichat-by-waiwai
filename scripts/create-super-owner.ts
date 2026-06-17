import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find((arg) => arg.startsWith("--email="));
  const passwordArg = args.find((arg) => arg.startsWith("--password="));
  const displayNameArg = args.find((arg) => arg.startsWith("--displayName=")) || "--displayName=Super Admin";

  if (!emailArg || !passwordArg) {
    console.error("Usage: npx tsx scripts/create-super-owner.ts --email=<email> --password=<password> [--displayName=<name>]");
    process.exit(1);
  }

  const email = emailArg.split("=")[1].trim().toLowerCase();
  const password = passwordArg.split("=")[1].trim();
  const displayName = displayNameArg.split("=")[1].trim();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.error(`User with email ${email} already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const superOwner = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        isSuperOwner: true,
        emailVerified: true
      }
    });

    console.log(`Successfully created SuperOwner:`);
    console.log(`ID: ${superOwner.id}`);
    console.log(`Email: ${superOwner.email}`);
    console.log(`Display Name: ${superOwner.displayName}`);
    process.exit(0);
  } catch (err) {
    console.error("Error creating SuperOwner:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
