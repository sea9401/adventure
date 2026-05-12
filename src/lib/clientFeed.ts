// 전체 소식(서버 피드) — 클라이언트가 보고하는 라이브 이벤트.
//
// 라이브 전투의 드랍은 클라에서 굴리므로(onBattleEnd) 서버가 모른다 — "유실된 명품"이 나오면
// 여기로 한 줄 보고한다. 서버가 itemId 의 rarity 를 다시 확인하므로 가벼운 스푸핑은 막힌다.
// 부수 효과 — 실패해도 전투 결과 처리엔 영향 없음. fire-and-forget.

export function reportUniqueDrop(itemId: string): void {
  if (typeof fetch === "undefined") return;
  fetch("/api/feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "unique_drop", itemId }),
  }).catch(() => {
    /* 부수 효과 — 조용히 무시 */
  });
}
