import { Card } from "@omnichat/ui";
import { MessageSquare } from "lucide-react";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex h-dvh items-center justify-center overflow-y-auto bg-gradient-to-b from-[#F7F7FA] via-[#FCFCFD] to-[#EBEBFF] px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ECEBFF] opacity-70 blur-3xl" />
      <div className="absolute top-10 right-10 -z-10 h-96 w-96 rounded-full bg-blue-100/40 opacity-50 blur-3xl" />
      
      <Card className="relative z-10 w-[480px] max-w-[calc(100vw-32px)] p-8 border border-[#DEDDE6]/50 bg-white/85 backdrop-blur-md shadow-xl shadow-indigo-100/30 text-[#16182B] rounded-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4636D7] to-[#8B5CF6] text-white shadow-md shadow-indigo-200">
            <MessageSquare className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="font-heading text-base font-bold tracking-tight text-[#16182B]">
              ChatWai
            </p>
            <p className="text-xs text-[#767A8C]">
              Customer service workspace
            </p>
          </div>
        </div>
        {children}
      </Card>
    </main>
  );
}
