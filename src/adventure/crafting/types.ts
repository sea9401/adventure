// 제작(POST /api/craft) 의 클라↔서버 공유 타입. 서버 lib(lib/server/craft)도, 클라(page.tsx)도
// import 하므로 서버 전용 의존이 없는 이 파일에 둔다. (storage.ts 는 localStorage 라 클라 전용.)

import type { ItemId } from "../data/items";
import type { CraftTier } from "../data/craftQuality";
import type { PotionId } from "../data/potions";

// 서버가 실제로 적용한 제작 결과.
export type CraftResult =
  | { kind: "equipment"; itemId: ItemId; tier: CraftTier }
  | { kind: "potion"; potionId: PotionId; quantity: number };

// POST /api/craft 의 성공 응답 본체(ok 제외).
export type CraftOutcome = {
  inventory: Record<string, unknown>; // 새 inventory.v2 값
  crafting: Record<string, unknown>; // 새 crafting.v2 값
  result: CraftResult;
};

const CRAFT_ERROR_MESSAGES: Record<string, string> = {
  unknown_recipe: "그런 제작서가 없다.",
  not_learned: "아직 익히지 않은 제작서다.",
  missing_material: "재료가 부족하다.",
  missing_ingredient: "필요한 장비가 부족하다.",
  potion_full: "포션을 더 들 수 없다.",
};

export function craftErrorMessage(code: string): string {
  return CRAFT_ERROR_MESSAGES[code] ?? "제작할 수 없다.";
}
