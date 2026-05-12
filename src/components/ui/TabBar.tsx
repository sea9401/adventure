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
  // 탭이 많아 화면을 넘칠 때 줄바꿈 대신 가로 스크롤. 모바일에서 7+ 탭이 세로로 깨지는 걸 방지.
  scrollable?: boolean;
};

export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  size = "sm",
  className,
  scrollable = false,
}: TabBarProps<K>) {
  const cls = [
    "flex gap-1 border-b border-zinc-200 dark:border-zinc-800",
    scrollable
      ? "no-scrollbar flex-nowrap overflow-x-auto"
      : "",
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
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 ${SIZE[size]} transition-colors ${
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
