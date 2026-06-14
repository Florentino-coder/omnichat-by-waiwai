import { Card } from "@omnichat/ui";
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
