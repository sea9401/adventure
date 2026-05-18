// 저장된 EquippedItem 을 "지금" 데이터 정의로 재계산.
//
// 직렬화된 saved 인스턴스는 저장 시점의 stats/bonus 를 통째로 들고 있어, 밸런스 패치
// (예: 부적 행운 +3 → +2, 제작 variance 조정) 후에도 그대로 옛 수치로 보인다.
// 그래서 슬롯에서 꺼낼 때마다 (itemId, craftTier 또는 dropQuality) 로 다시 계산해 최신
// 정의의 stats/bonus 를 반영한다. 이름 매칭이 안 되면(아이템 삭제·rename) null —
// 슬롯에서 사라짐.
//
// ⚠️ 라이브(useCharacterState)·서버측 autoHunt/derivePlayerCombatFromSaves 모두 이
// 헬퍼를 공유해야 한다. 과거엔 두 서버 파일이 craftTier/dropQuality 를 무시하고 베이스
// 아이템만 돌려줘서, 걸작/빼어난 장비를 낀 유저의 서버측 스탯이 ±2~6 깎였고, feat
// 임계치 바로 위에 있던 빌드는 흡혈/곡예/천칭 같은 특기가 위탁 사냥에서 조용히 비활성화됐다.

import { ITEMS, findItemId } from "@/adventure/data/items";
import { resolveCraftedItem } from "@/adventure/data/recipes";
import { resolveDroppedItem } from "@/adventure/data/dropQuality";
import { isEnhanceable, resolveEnhancedItem } from "./enhancement";
import type { EquippedItem } from "./types";

export function rehydrateEquippedItem(
  saved: EquippedItem | null | undefined,
): EquippedItem | null {
  if (!saved) return null;
  const id = findItemId(saved);
  if (!id) return null;
  // 인스턴스 기반(강화 가능 장비) — instanceId + enhancementLevel 가 박혀 있어야 정상.
  // 둘 다 없으면 인스턴스가 풀로 풀려 나간 옛 상태(테스트·서버 마이그레이션 도중 등) →
  // 베이스 아이템으로 떨어뜨림(슬롯에 안 머무르고 자연 회수).
  if (isEnhanceable(id)) {
    if (typeof saved.instanceId !== "string" || !saved.instanceId) return null;
    const lv = saved.enhancementLevel ?? 0;
    return resolveEnhancedItem(id, saved.craftTier, lv, saved.instanceId);
  }
  const tier = saved.craftTier;
  if (tier != null && tier !== 0) return resolveCraftedItem(id, tier);
  const q = saved.dropQuality;
  if (q === 1 || q === 2) return resolveDroppedItem(id, q);
  return ITEMS[id];
}
