import { Button, Input, Label } from "@omnichat/ui";

export default function ResetPasswordPage() {
  return (
    <section aria-labelledby="reset-heading" className="space-y-5">
      <div>
        <h1 id="reset-heading" className="font-heading text-xl font-medium">
          New password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a password for this account.</p>
      </div>
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" />
        </div>
        <Button className="w-full" type="submit">
          Update password
        </Button>
      </form>
    </section>
  );
}
