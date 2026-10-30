# Super Owner two-factor authentication

The platform console (`/super-admin`, `/app/admin/monitor`) reaches every tenant, so `SuperOwnerGuard` refuses Super Owner API calls with `SUPER_OWNER_2FA_REQUIRED` until 2FA is on.

## First sign-in after this is deployed

1. Sign in with your password as usual. Password sign-in still works without 2FA.
2. You are sent to `/super-admin/security`.
3. Add the setup key to an authenticator app and enter the code.
4. Keep a copy of the setup key somewhere safe and offline. There are no recovery codes.

After that, the login page asks for the 6-digit code.

## If you lose your authenticator

There is no self-service reset. Someone with production database access must turn it off, then you set it up again at next sign-in.

Back up the database before running this. Replace the email with the Super Owner's address.

```sql
UPDATE users
SET "twoFaEnabled" = false, "twoFaSecret" = NULL
WHERE email = 'owner@example.com' AND "isSuperOwner" = true;
```

Check the column names in `prisma/schema.prisma` first. Do this only after confirming who is asking.

## Setup can't overwrite an enrolled authenticator

`POST /auth/2fa/setup` and `POST /auth/2fa/super-owner/setup` return `409` once 2FA is on, so a stolen session cannot replace the authenticator.
