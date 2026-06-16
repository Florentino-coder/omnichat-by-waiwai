import { Card } from "@omnichat/ui";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50/50 dark:bg-zinc-950 px-4 py-12">
      <Card className="w-[480px] max-w-[calc(100vw-32px)] p-8 shadow-xl shadow-slate-100/40 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 font-heading text-lg font-bold text-white shadow-sm shadow-emerald-600/30">
            C
          </div>
          <div>
            <p className="font-heading text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">OmniChat SaaS</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Customer service workspace</p>
          </div>
        </div>
        {children}
      </Card>
    </main>
  );
}
