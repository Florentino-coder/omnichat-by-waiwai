import { Search } from "lucide-react";
import { type ReactNode } from "react";
import { ConversationCard, type ConversationCardProps } from "./ConversationCard";
import { FilterPills, type FilterPill } from "./FilterPills";

interface ConversationListProps {
  conversations: ConversationCardProps[];
  filters: FilterPill[];
  activeFilter: string;
  searchValue: string;
  emptyText?: string;
  footer?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (id: string) => void;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  conversations,
  filters,
  activeFilter,
  searchValue,
  emptyText = "No conversations",
  footer,
  isLoading = false,
  loadingText = "Loading conversations...",
  onSearchChange,
  onFilterChange,
  onSelectConversation
}: ConversationListProps) {
  return (
    <aside className="flex min-h-0 w-full flex-col border-r border-border bg-white">
      <div className="shrink-0 border-b border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[13px] font-medium">แชท</h2>
          <Search size={17} aria-hidden="true" className="text-muted-foreground" />
        </div>
        <label className="relative block">
          <span className="sr-only">ค้นหาแชท</span>
          <Search
            size={14}
            aria-hidden="true"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-9 w-full rounded-md border border-border bg-secondary pl-8 pr-3 text-xs outline-none focus:border-primary"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ค้นหาแชท..."
            value={searchValue}
          />
        </label>
        <div className="mt-3">
          <FilterPills filters={filters} activeFilter={activeFilter} onChange={onFilterChange} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? <ConversationListSkeleton label={loadingText} /> : null}
        {!isLoading && conversations.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{emptyText}</p>
        ) : null}
        {!isLoading &&
          conversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              {...conversation}
              onSelect={onSelectConversation}
            />
          ))}
      </div>
      {footer}
    </aside>
  );
}

function ConversationListSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-2 p-3" aria-label={label}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-20 rounded-md bg-secondary" />
      ))}
    </div>
  );
}

export { ConversationCard } from "./ConversationCard";
export { FilterPills };
export type { ConversationCardProps, FilterPill };
