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
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {filters.map((filter) => {
        const isActive = filter.id === activeFilter;
        return (
          <button
            key={filter.id}
            className={[
              "h-8 shrink-0 rounded-full px-3 text-sm font-semibold transition-colors",
              isActive
                ? "bg-primary text-white shadow-[0_6px_14px_rgba(70,54,215,0.18)]"
                : "bg-white text-[#595B66] hover:bg-primary-soft hover:text-primary"
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
