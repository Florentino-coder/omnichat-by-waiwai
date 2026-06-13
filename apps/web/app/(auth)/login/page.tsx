import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <section aria-labelledby="login-heading" className="space-y-5">
      <div>
        <h1 id="login-heading" className="font-heading text-xl font-medium">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Access your tenant workspace.</p>
      </div>
      <LoginForm />
      <a className="text-sm font-medium text-primary" href="/forgot-password">
        Forgot password
      </a>
    </section>
  );
}
