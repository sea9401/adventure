// 상점 buy/sell 의 클라↔서버 공유 타입. 서버 lib(lib/server/shop)도, 클라(page.tsx)도
// import 하므로 서버 전용 의존이 없는 이 파일에 둔다.

export type ShopActionKind =
  | "buy_potion"
  | "buy_material"
  | "buy_consumable"
  | "sell_potion"
  | "sell_material"
  | "sell_equipment";

export type ShopAction = { kind: ShopActionKind; id: string; quantity: number };

// 서버가 실제로 적용한 결과 — 클라 토스트/칭호/해금 알림 구성용.
export type ShopApplied = {
  kind: ShopActionKind;
  id: string;
  quantity: number; // 실제 적용 수량 (포션 캡으로 줄어들 수 있음)
  goldDelta: number; // 캐릭터 골드 변화 (구매 음수, 판매 양수, 0G 정리면 0)
};

// POST /api/shop 의 성공 응답 본체(ok 제외).
export type ShopOutcome = {
  character: Record<string, unknown>; // 새 character.v2 값
  inventory: Record<string, unknown>; // 새 inventory.v2 값
  applied: ShopApplied;
};
