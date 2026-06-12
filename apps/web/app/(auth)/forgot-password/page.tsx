import { Button, Input, Label } from "@omnichat/ui";

export default function ForgotPasswordPage() {
  return (
    <section aria-labelledby="forgot-heading" className="space-y-5">
      <div>
        <h1 id="forgot-heading" className="font-heading text-xl font-medium">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Send reset link to your email.</p>
      </div>
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" />
        </div>
        <Button className="w-full" type="submit">
          Send link
        </Button>
      </form>
    </section>
  );
}
