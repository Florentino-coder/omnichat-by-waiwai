import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  emptyText = "ยังไม่มีแชท LINE",
  footer,
  isLoading = false,
  loadingText = "กำลังโหลดแชท...",
  onSearchChange,
  onFilterChange,
  onSelectConversation
}: ConversationListProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(!!searchValue);

  return (
    <aside className="flex min-h-0 w-full flex-col border-r border-border bg-white">
      <div className="shrink-0 border-b border-border px-5 py-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">กล่องข้อความ</h2>
          <button
            onClick={() => {
              if (isSearchOpen) {
                onSearchChange("");
              }
              setIsSearchOpen(!isSearchOpen);
            }}
            className={`rounded-full p-1.5 transition-colors hover:bg-slate-100 ${isSearchOpen ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
            aria-label={isSearchOpen ? "ปิดกล่องค้นหา" : "เปิดกล่องค้นหา"}
          >
            <Search size={21} aria-hidden="true" />
          </button>
        </div>
        <div 
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isSearchOpen ? "max-h-[60px] opacity-100 mb-4" : "max-h-0 opacity-0 pointer-events-none mb-0"
          }`}
        >
          <label className="relative block">
            <span className="sr-only">ค้นหาแชท</span>
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              className="h-12 w-full rounded-[14px] border border-[#D8D6E0] bg-[#F7F6FB] pl-11 pr-4 text-sm font-medium outline-none placeholder:text-[#9A9DB0] focus:border-primary focus:bg-white transition-colors"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="ค้นหาแชท..."
              value={searchValue}
            />
          </label>
        </div>
        <div>
          <FilterPills filters={filters} activeFilter={activeFilter} onChange={onFilterChange} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? <ConversationListSkeleton label={loadingText} /> : null}
        {!isLoading && conversations.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">{emptyText}</p>
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
    <div className="grid gap-0" aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-[120px] border-b border-border bg-secondary" />
      ))}
    </div>
  );
}

export { ConversationCard } from "./ConversationCard";
export { FilterPills };
export type { ConversationCardProps, FilterPill };
