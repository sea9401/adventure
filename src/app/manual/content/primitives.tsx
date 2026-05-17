import type { ReactNode } from "react";

// 메뉴얼 본문 공용 프리미티브.
// 페이지 안에서 일관된 타이포/간격을 유지하려고 외부에서 일반 <h2>·<p>·<table>
// 대신 이 컴포넌트들을 쓴다.

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 text-lg font-semibold text-zinc-900 first:mt-0 dark:text-zinc-100">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-5 text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      {children}
    </p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-2 space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 [&>li]:list-disc">
      {children}
    </ul>
  );
}

export function Em({ children }: { children: ReactNode }) {
  return (
    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
      {children}
    </strong>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-px font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
      {children}
    </div>
  );
}

export function Table({
  head,
  rows,
  caption,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        {caption && (
          <caption className="caption-bottom px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            {caption}
          </caption>
        )}
        <thead className="bg-zinc-50 dark:bg-zinc-900/60">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-t border-zinc-100 dark:border-zinc-800/70"
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className="px-3 py-2 align-top text-zinc-700 dark:text-zinc-300"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
