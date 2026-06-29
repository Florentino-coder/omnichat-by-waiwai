import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <section aria-labelledby="forgot-heading" className="space-y-6">
      <div>
        <h1 id="forgot-heading" className="font-heading text-xl font-semibold text-white">
          Reset password
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          Enter the username or email you use to sign in, plus the email registered on your account.
        </p>
      </div>
      <ForgotPasswordForm />
    </section>
  );
}
