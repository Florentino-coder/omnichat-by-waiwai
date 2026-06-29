import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <section aria-labelledby="forgot-heading" className="space-y-5">
      <div>
        <h1 id="forgot-heading" className="font-heading text-xl font-medium">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your account with your registered email, then set a new password.
        </p>
      </div>
      <ForgotPasswordForm />
    </section>
  );
}
