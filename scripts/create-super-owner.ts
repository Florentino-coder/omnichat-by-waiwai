import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createSuperOwner } from "../apps/api/src/scripts/super-owner-create";
import { describeDatabaseHost, loadLocalEnv } from "../apps/api/src/scripts/super-owner-reset";

// The password is read from a hidden prompt, never from arguments, so it does not
// end up in shell history.
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

function readArg(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const email = readArg(args, "email");
  const username = readArg(args, "username");
  const displayName = readArg(args, "displayName") ?? "Super Admin";

  if (!email) {
    console.error(
      "Usage: npx tsx scripts/create-super-owner.ts --email=<email> [--username=<username>] [--displayName=<name>]"
    );
    process.exit(1);
  }

  loadLocalEnv();
  const host = describeDatabaseHost(process.env.DATABASE_URL);
  if (host === "unknown") {
    console.error("DATABASE_URL is not set. Nothing was changed.");
    process.exit(1);
  }
  console.log(`Database: ${host}`);
  console.log(`Email: ${email}`);
  console.log(`Username: ${username ?? "(none)"}`);

  if ((await ask("Type the database host to continue: ")).trim() !== host) {
    console.error("Host did not match. Nothing was changed.");
    process.exit(1);
  }

  const password = await askHidden("Password: ");
  if (password !== (await askHidden("Repeat password: "))) {
    console.error("Passwords did not match. Nothing was changed.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const owner = await createSuperOwner(prisma, { email, username, password, displayName });
    console.log(`Created Super Owner ${owner.id} (${owner.username ?? owner.email}).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
