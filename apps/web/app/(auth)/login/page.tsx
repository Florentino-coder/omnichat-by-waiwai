import { Button, Input, Label } from "@omnichat/ui";

export default function LoginPage() {
  return (
    <section aria-labelledby="login-heading" className="space-y-5">
      <div>
        <h1 id="login-heading" className="font-heading text-xl font-medium">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Access your tenant workspace.</p>
      </div>
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" />
        </div>
        <Button className="w-full" type="submit">
          Sign in
        </Button>
      </form>
      <a className="text-sm font-medium text-primary" href="/forgot-password">
        Forgot password
      </a>
    </section>
  );
}
