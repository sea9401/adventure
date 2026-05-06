import type { ReactNode } from "react";

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-line rounded-lg bg-panel/40">
      <div className="px-4 py-2 border-b border-line text-xs uppercase tracking-wider text-fg-faint">
        {title}
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

export function CollapsiblePanel({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-line rounded-lg bg-panel/40">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 border-b border-line text-xs uppercase tracking-wider text-fg-faint flex items-center justify-between hover:bg-panel-2/50 transition-colors"
      >
        <span>{title}</span>
        <span className="text-fg-muted">{collapsed ? "▶" : "▼"}</span>
      </button>
      {!collapsed && <div className="p-4 space-y-2">{children}</div>}
    </div>
  );
}
