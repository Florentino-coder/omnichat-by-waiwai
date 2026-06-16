interface TagListProps {
  tags: string[];
  onAdd?: () => void;
}

export function TagList({ tags, onAdd }: TagListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-[#E8EBFF] px-3 py-1.5 text-sm font-semibold text-[#4E47C8]">
          {tag}
        </span>
      ))}
      <button
        className="rounded-full border-2 border-dashed border-[#C9C7D1] px-4 py-1.5 text-sm font-semibold text-muted-foreground"
        onClick={onAdd}
        type="button"
      >
        + เพิ่ม
      </button>
    </div>
  );
}
