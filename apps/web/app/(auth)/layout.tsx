import { Card } from "@omnichat/ui";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12">
      <Card className="w-[480px] max-w-[calc(100vw-32px)] p-8 border border-indigo-500/20 bg-slate-950/40 backdrop-blur-md shadow-2xl shadow-indigo-950/40 text-slate-100">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-heading text-lg font-bold text-white shadow-sm shadow-indigo-600/30">
            CW
          </div>
          <div>
            <p className="font-heading text-base font-semibold tracking-tight text-white">Chat-Wai</p>
            <p className="text-xs text-indigo-300/70">Customer service workspace</p>
          </div>
        </div>
        {children}
      </Card>
    </main>
  );
}
