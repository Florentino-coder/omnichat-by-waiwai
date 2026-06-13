import { Card } from "@omnichat/ui";
import { LineChannelForm } from "./line-channel-form";

export default function SettingsPage() {
  return (
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
    </section>
  );
}
