export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// 거래소 매물 등록 시각 등 — "방금 전 / 12분 전 / 3시간 전 / 1일 전" 형식.
// 24h TTL 룰과 함께 — 1일 이상은 거의 등장하지 않지만 안전하게 처리.
export function formatRelativeTime(date: Date | string | number): string {
  const t = typeof date === "object" ? date.getTime() : new Date(date).getTime();
  const diffMs = Date.now() - t;
  if (!Number.isFinite(diffMs)) return "";
  if (diffMs < 0) return "방금 전";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
