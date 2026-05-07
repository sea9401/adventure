"use client";

type TabSize = "sm" | "md";

const SIZE: Record<TabSize, string> = {
  sm: "px-3 py-2 text-sm font-medium",
  md: "px-4 py-2 text-base font-semibold",
};

export type TabBarProps<K extends string> = {
  tabs: ReadonlyArray<{ key: K; label: string }>;
  active: K;
  onChange: (next: K) => void;
  ariaLabel: string;
  size?: TabSize;
  className?: string;
};

export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  size = "sm",
  className,
}: TabBarProps<K>) {
  const cls = [
    "flex gap-1 border-b border-zinc-200 dark:border-zinc-800",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <nav role="tablist" aria-label={ariaLabel} className={cls}>
      {tabs.map((t) => {
        const selected = active === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(t.key)}
            className={`-mb-px border-b-2 ${SIZE[size]} transition-colors ${
              selected
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
