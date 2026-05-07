import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
      <div className="mx-auto inline-flex text-zinc-400 dark:text-zinc-500">
        {icon}
      </div>
      <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </div>
      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {message}
      </div>
    </section>
  );
}
