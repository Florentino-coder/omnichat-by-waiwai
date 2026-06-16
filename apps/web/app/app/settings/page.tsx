import { Card } from "@omnichat/ui";
import Link from "next/link";
import { LineChannelForm } from "./line-channel-form";
import { QuickReplyManager } from "./quick-reply-manager";

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <section aria-labelledby="settings-heading" className="max-w-3xl">
        <h1 id="settings-heading" className="font-heading text-2xl font-medium">
          Settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure production channels and app settings.
        </p>
        <Card className="mt-6 flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-heading text-base font-medium">Team management</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite agents, review members, and adjust tenant roles.
            </p>
          </div>
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-secondary px-3 text-sm font-medium text-foreground hover:bg-primary-soft"
            href="/app/settings/team"
          >
            Open team
          </Link>
        </Card>
        <Card className="mt-6 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-base font-medium">LINE channel</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Save the LINE OA credentials used for webhook verification and replies.
            </p>
          </div>
          <LineChannelForm />
        </Card>
        <Card className="mt-6 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-base font-medium">Quick Reply</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Manage reusable replies per LINE OA. Agents see only replies for the selected conversation channel.
            </p>
          </div>
          <QuickReplyManager />
        </Card>
      </section>
    </div>
  );
}
