"use client";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-4 bg-[#F7F7FA] p-8 text-center">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
      >
        Try again
      </button>
    </div>
  );
}
