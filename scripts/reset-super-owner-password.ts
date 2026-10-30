import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import {
  describeDatabaseHost,
  resetSuperOwnerPassword
} from "../apps/api/src/scripts/super-owner-reset";

// The password is read from a hidden prompt, never from arguments, so it does not
// end up in shell history. See docs/security/super-owner-2fa.md.
async function askHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    }
  });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  const answer = prompt.question(question);
  muted = true;
  const value = await answer;
  prompt.close();
  process.stdout.write("\n");
  return value;
}

async function ask(question: string): Promise<string> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const value = await prompt.question(question);
  prompt.close();
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const email = args.find((arg) => arg.startsWith("--email="))?.split("=")[1];
  const resetTwoFa = args.includes("--reset-2fa");

  if (!email) {
    console.error(
      "Usage: npx tsx scripts/reset-super-owner-password.ts --email=<email> [--reset-2fa]"
    );
    process.exit(1);
  }

  const host = describeDatabaseHost(process.env.DATABASE_URL);
  console.log(`Database: ${host}`);
  console.log(`Super Owner: ${email}`);
  console.log(`Also clear 2FA: ${resetTwoFa ? "yes" : "no"}`);

  if ((await ask(`Type the database host to continue: `)).trim() !== host) {
    console.error("Host did not match. Nothing was changed.");
    process.exit(1);
  }

  const password = await askHidden("New password: ");
  if (password !== (await askHidden("Repeat new password: "))) {
    console.error("Passwords did not match. Nothing was changed.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const { userId } = await resetSuperOwnerPassword(prisma, { email, password, resetTwoFa });
    console.log(`Password updated and sessions revoked for Super Owner ${userId}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
