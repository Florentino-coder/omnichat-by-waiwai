import { Button, Input, Label } from "@omnichat/ui";

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section aria-labelledby="invite-heading" className="w-[360px] max-w-[calc(100vw-32px)] space-y-5 rounded-lg border border-border bg-card p-6">
        <div>
          <h1 id="invite-heading" className="font-heading text-xl font-medium">
            Accept invite
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your OmniChat account.</p>
        </div>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" />
          </div>
          <Button className="w-full" type="submit">
            Join workspace
          </Button>
        </form>
      </section>
    </main>
  );
}
