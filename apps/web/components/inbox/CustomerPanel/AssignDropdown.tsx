interface AssignDropdownProps {
  value: string;
  options: Array<{ id: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function AssignDropdown({ value, options, disabled = false, onChange }: AssignDropdownProps) {
  return (
    <label className="grid gap-2 text-xs font-medium text-muted-foreground">
      มอบหมาย
      <select
        className="h-9 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Unassigned</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
