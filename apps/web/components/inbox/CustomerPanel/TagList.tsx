interface TagListProps {
  tags: string[];
  onAdd?: () => void;
}

export function TagList({ tags, onAdd }: TagListProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-[#E0E7FF] px-2.5 py-1 text-[11px] text-[#3730A3]">
          {tag}
        </span>
      ))}
      <button
        className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground"
        onClick={onAdd}
        type="button"
      >
        + เพิ่ม
      </button>
    </div>
  );
}
