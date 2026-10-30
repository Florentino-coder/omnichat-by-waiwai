# Super Owner two-factor authentication

The platform console (`/super-admin`, `/app/admin/monitor`) reaches every tenant, so `SuperOwnerGuard` refuses Super Owner API calls with `SUPER_OWNER_2FA_REQUIRED` until 2FA is on.

## First sign-in after this is deployed

1. Sign in with your password as usual. Password sign-in still works without 2FA.
2. You are sent to `/super-admin/security`.
3. Add the setup key to an authenticator app and enter the code.
4. Keep a copy of the setup key somewhere safe and offline. There are no recovery codes.

After that, the login page asks for the 6-digit code.

## Creating a Super Owner

```bash
npx tsx scripts/create-super-owner.ts --email=owner@example.com --username=owners
```

`--username` is optional. You can sign in with the email or the username. The script reads `DATABASE_URL` from the environment or `.env`, asks you to type the database host to confirm, then asks for the password in a hidden prompt.

## If you forget your password

**Use the login page first.** Click **Forgot password**, enter your email, and open the link sent to your inbox. The link lasts 30 minutes. It needs `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` set on the API. Your 2FA stays on.

**If the email does not arrive**, use the script below. It needs `DATABASE_URL` for production. It asks you to type the database host to confirm, then asks for the new password in a hidden prompt. It only matches Super Owner accounts, and it signs out existing sessions.

```bash
npx tsx scripts/reset-super-owner-password.ts --email=owner@example.com
```

After 10 failed sign-ins, an account is locked for 15 minutes. Resetting the password by script does not clear that lock, so wait it out.

## If you lose your authenticator

There is no self-service reset. Someone with production database access runs the script with `--reset-2fa`, which also sets a new password. You then set up 2FA again at next sign-in. Do this only after confirming who is asking.

```bash
npx tsx scripts/reset-super-owner-password.ts --email=owner@example.com --reset-2fa
```

## Setup can't overwrite an enrolled authenticator

`POST /auth/2fa/setup` and `POST /auth/2fa/super-owner/setup` return `409` once 2FA is on, so a stolen session cannot replace the authenticator.
