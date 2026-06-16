import { Suspense } from "react";
import { AcceptInviteClient } from "./accept-client";

function AcceptInviteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-[380px] max-w-[calc(100vw-32px)] space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="h-7 w-32 rounded-md bg-secondary" />
        <div className="h-10 rounded-md bg-secondary" />
        <div className="h-10 rounded-md bg-secondary" />
        <div className="h-10 rounded-md bg-secondary" />
      </section>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteFallback />}>
      <AcceptInviteClient />
    </Suspense>
  );
}
