// 로딩 자리 표시자 — 데이터 fetch 중 빈 화면 대신.
// rows 가 주어지면 그 줄 수만큼 height-2 스켈레톤 라인을 세로로 쌓는다.
export function Skeleton({
  className = "",
  rows,
}: {
  className?: string;
  rows?: number;
}) {
  if (rows && rows > 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`h-3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`}
            style={{ width: `${85 - (i % 3) * 10}%` }}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`}
    />
  );
}
