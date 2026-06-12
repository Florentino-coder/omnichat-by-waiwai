import { Button } from "@omnichat/ui";

export default function VerifyEmailPage() {
  return (
    <section aria-labelledby="verify-heading" className="space-y-5">
      <div>
        <h1 id="verify-heading" className="font-heading text-xl font-medium">
          Verify email
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm account email before login.</p>
      </div>
      <Button className="w-full">Continue</Button>
    </section>
  );
}
