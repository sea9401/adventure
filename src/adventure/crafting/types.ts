// 제작(POST /api/craft) 의 클라↔서버 공유 타입. 서버 lib(lib/server/craft)도, 클라(page.tsx)도
// import 하므로 서버 전용 의존이 없는 이 파일에 둔다. (storage.ts 는 localStorage 라 클라 전용.)

import type { ItemId } from "../data/items";
import type { CraftTier } from "../data/craftQuality";
import type { PotionId } from "../data/potions";

// 한 번에 제작 가능한 최대 수량. 클라(입력 클램프) / 서버(검증) 양쪽이 같은 값을 봐야 한다.
// 포션 보유 한도(타입당 ~10) 보다 훨씬 크지만, 단일 트랜잭션 한 번에 너무 많은 등급 추첨/feed
// 삽입이 폭주하지 않도록 50 으로 막아 둔다.
export const CRAFT_BATCH_MAX = 50;

// 서버가 실제로 적용한 제작 결과 — 한 회분.
export type CraftResult =
  | { kind: "equipment"; itemId: ItemId; tier: CraftTier }
  | { kind: "potion"; potionId: PotionId; quantity: number };

// POST /api/craft 의 성공 응답 본체(ok 제외). 배치 제작 시 results 는 호출 수량만큼 채워지고,
// 단일 제작이면 길이 1. 등급 추첨은 회마다 독립이므로 같은 장비 레시피라도 results 안 각 원소의
// tier 가 다를 수 있다.
export type CraftOutcome = {
  inventory: Record<string, unknown>; // 새 inventory.v2 값
  crafting: Record<string, unknown>; // 새 crafting.v2 값
  results: CraftResult[];
};

const CRAFT_ERROR_MESSAGES: Record<string, string> = {
  unknown_recipe: "그런 제작서가 없다.",
  not_learned: "아직 익히지 않은 제작서다.",
  missing_material: "재료가 부족하다.",
  missing_ingredient: "필요한 장비가 부족하다.",
  potion_full: "포션을 더 들 수 없다.",
  invalid_quantity: "제작 수량이 잘못됐다.",
};

export function craftErrorMessage(code: string): string {
  return CRAFT_ERROR_MESSAGES[code] ?? "제작할 수 없다.";
}
