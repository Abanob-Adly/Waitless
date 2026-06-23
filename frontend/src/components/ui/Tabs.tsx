import { useState, type ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  defaultTab?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Tabs({ items, defaultTab }: TabsProps) {
  const [activeId, setActiveId] = useState(defaultTab ?? items[0]?.id ?? "");
  const activeItem = items.find((i) => i.id === activeId);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveId(item.id)}
            className={`relative px-5 py-3 text-sm font-medium transition ${
              activeId === item.id
                ? "text-gold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gold"
                : "text-navy-mid hover:text-navy"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="pt-6">{activeItem?.content}</div>
    </div>
  );
}
