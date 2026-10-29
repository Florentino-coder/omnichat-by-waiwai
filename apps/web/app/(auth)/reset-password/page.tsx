import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const resetToken = Array.isArray(token) ? (token[0] ?? "") : (token ?? "");

  return (
    <section aria-labelledby="reset-heading" className="space-y-6">
      <div>
        <h1 id="reset-heading" className="font-heading text-xl font-semibold text-[#16182B]">
          New password
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Choose a new password for this account.
        </p>
      </div>
      <ResetPasswordForm token={resetToken} />
    </section>
  );
}
