export interface FilterPill {
  id: string;
  label: string;
  count?: number;
}

interface FilterPillsProps {
  filters: FilterPill[];
  activeFilter: string;
  onChange: (id: string) => void;
}

export function FilterPills({ filters, activeFilter, onChange }: FilterPillsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
      {filters.map((filter) => {
        const isActive = filter.id === activeFilter;
        return (
          <button
            key={filter.id}
            className={[
              "h-7 shrink-0 rounded-full px-2.5 text-[11px] font-medium",
              isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
            ].join(" ")}
            onClick={() => onChange(filter.id)}
            type="button"
          >
            {filter.label}
            {typeof filter.count === "number" ? ` · ${filter.count}` : ""}
          </button>
        );
      })}
    </div>
  );
}
