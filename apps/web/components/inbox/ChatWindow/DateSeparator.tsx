interface DateSeparatorProps {
  label: string;
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="h-px flex-1 bg-[#D9D7E1]" />
      <span className="text-sm font-semibold text-[#7A7C8D]">{label}</span>
      <div className="h-px flex-1 bg-[#D9D7E1]" />
    </div>
  );
}
