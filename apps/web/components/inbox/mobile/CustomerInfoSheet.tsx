import { X } from "lucide-react";
import { CustomerPanel } from "../CustomerPanel";

interface CustomerInfoSheetProps {
  isOpen: boolean;
  customerName: string;
  customerInitial: string;
  lineLabel: string;
  onClose: () => void;
}

export function CustomerInfoSheet({
  isOpen,
  customerName,
  customerInitial,
  lineLabel,
  onClose
}: CustomerInfoSheetProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="fixed inset-0 z-40 bg-white md:hidden">
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <button aria-label="Close customer info" onClick={onClose} type="button">
          <X size={18} aria-hidden="true" />
        </button>
        <h2 className="text-[13px] font-medium">ข้อมูลลูกค้า</h2>
        <span className="w-[18px]" />
      </header>
      <CustomerPanel
        customerName={customerName}
        customerInitial={customerInitial}
        lineLabel={lineLabel}
      />
    </section>
  );
}
