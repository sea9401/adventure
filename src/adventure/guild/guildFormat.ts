// 길드 UI 공용 시간 포맷터.

export function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 60_000) return "곧";
    if (ahead < 3_600_000) return `${Math.floor(ahead / 60_000)}분 후`;
    if (ahead < 86_400_000) return `${Math.floor(ahead / 3_600_000)}시간 후`;
    const days = Math.floor(ahead / 86_400_000);
    const hours = Math.floor((ahead % 86_400_000) / 3_600_000);
    return hours > 0 ? `${days}일 ${hours}시간 후` : `${days}일 후`;
  }
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

export function formatClock(d: Date): string {
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
