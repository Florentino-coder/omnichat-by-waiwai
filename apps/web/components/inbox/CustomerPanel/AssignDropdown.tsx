interface AssignDropdownProps {
  value: string;
  options: Array<{ id: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function AssignDropdown({ value, options, disabled = false, onChange }: AssignDropdownProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-muted-foreground">
      มอบหมาย
      <select
        className="h-12 rounded-xl border border-border bg-[#F7F6FB] px-3 text-base text-foreground outline-none focus:border-primary"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">เลือกพนักงาน</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
