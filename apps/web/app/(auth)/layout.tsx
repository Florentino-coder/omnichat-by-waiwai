import { Card } from "@omnichat/ui";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-[360px] max-w-[calc(100vw-32px)] p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-medium text-white">
            O
          </div>
          <div>
            <p className="font-heading text-base font-medium text-foreground">OmniChat</p>
            <p className="text-xs text-muted-foreground">Customer service workspace</p>
          </div>
        </div>
        {children}
      </Card>
    </main>
  );
}
