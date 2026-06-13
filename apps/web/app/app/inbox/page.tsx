import { Badge, Button, Card } from "@omnichat/ui";
import { SendHorizontal } from "lucide-react";

const sampleConversations = [
  {
    id: "1",
    name: "LINE customer",
    channel: "Main LINE",
    preview: "Latest inbound messages will appear here.",
    time: "Now",
    unread: 0
  }
];

export default function InboxPage() {
  return (
    <section aria-labelledby="inbox-heading" className="min-h-[calc(100vh-7rem)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 id="inbox-heading" className="font-heading text-2xl font-medium">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            LINE conversations synced from verified webhooks.
          </p>
        </div>
        <Badge variant="primary">Stage 3</Badge>
      </div>

      <div className="grid min-h-[560px] grid-cols-[280px_minmax(0,1fr)_260px] overflow-hidden rounded-lg border border-border bg-card">
        <aside className="border-r border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-heading text-sm font-medium">Conversations</h2>
            <p className="mt-1 text-xs text-muted-foreground">Newest activity first</p>
          </div>
          <div className="divide-y divide-border">
            {sampleConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="w-full bg-primary-soft px-4 py-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {conversation.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {conversation.preview}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {conversation.time}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="muted">{conversation.channel}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {conversation.unread} unread
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col bg-secondary/50" aria-labelledby="thread-heading">
          <div className="flex h-14 items-center justify-between border-b border-border bg-white px-5">
            <div>
              <h2 id="thread-heading" className="font-heading text-sm font-medium">
                Message thread
              </h2>
              <p className="text-xs text-muted-foreground">Replies use Stage 2 LINE API.</p>
            </div>
            <Badge variant="success">Open</Badge>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            <Card className="max-w-[72%] p-3">
              <p className="text-sm">Messages from LINE will render here after API binding.</p>
              <p className="mt-2 text-xs text-muted-foreground">Inbound</p>
            </Card>
            <Card className="ml-auto max-w-[72%] border-primary bg-primary text-white p-3">
              <p className="text-sm">Agent replies are stored as outbound messages.</p>
              <p className="mt-2 text-xs text-white/80">Outbound</p>
            </Card>
          </div>

          <form className="flex gap-3 border-t border-border bg-white p-4">
            <label className="sr-only" htmlFor="reply-text">
              Reply text
            </label>
            <textarea
              id="reply-text"
              aria-label="Reply text"
              className="min-h-20 flex-1 resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground"
              disabled
              placeholder="Reply composer connects in Checkpoint C"
            />
            <Button className="gap-2 self-end" disabled>
              <SendHorizontal aria-hidden="true" size={16} />
              Send reply
            </Button>
          </form>
        </section>

        <aside className="border-l border-border bg-white" aria-labelledby="context-heading">
          <div className="border-b border-border px-4 py-3">
            <h2 id="context-heading" className="font-heading text-sm font-medium">
              Customer context
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">CRM detail starts in Stage 4</p>
          </div>
          <dl className="space-y-4 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Source</dt>
              <dd className="mt-1 font-medium">LINE OA</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Assignment</dt>
              <dd className="mt-1 font-medium">Unassigned</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Priority</dt>
              <dd className="mt-1 font-medium">Normal</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

