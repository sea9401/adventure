// 제작 품질 등급 — 제작(= /api/craft 한 번)으로 나오는 장비에만 적용.
//
// 5단계: 불량(−2u) / 하급(−1u) / 일반(0) / 고급(+1u) / 걸작(+2u).
// `u` 는 레시피별 폭(recipes.ts 의 variance / varianceTable). 가중치는 가운데(일반)로
// 몰리고 양 끝이 희소 — `걸작` 6%. 등급 추첨은 서버에서만 한다(rollCraftTier).
//
// 표시값(아이템 카드의 stats) = `일반` 등급 = 분포의 중앙값 = 평균.
//
// 변동 정의 두 형태(레시피에 둘 다 옵셔널, 같은 스탯에 둘 다 있으면 varianceTable 우선):
//   variance:      스탯별 폭 u.  bonus[stat] += tier × u_stat
//   varianceTable: 스탯별 [불량,하급,일반,고급,걸작] 델타를 직접 명시 (저수치/비선형 아이템).
// 둘 다 없으면 변동 없음 — 항상 `일반`(tier 0).

import {
  BONUS_KEYS,
  BONUS_LABELS,
  signedBonus,
  type EquipBonus,
  type EquipItem,
} from "./items";

export type CraftTier = -2 | -1 | 0 | 1 | 2;

// 추첨 순서 + 0(일반)을 제외한 "비-기본" 등급 — craftedEquipment 인벤토리는 이 4종만 담는다.
export const CRAFT_TIERS: readonly CraftTier[] = [-2, -1, 0, 1, 2];

export const CRAFT_TIER_NAMES: Record<CraftTier, string> = {
  [-2]: "불량",
  [-1]: "하급",
  0: "일반",
  1: "고급",
  2: "걸작",
};

// 가중 추첨 비율 (합 100). 가운데(일반)로 몰리고 양 끝이 희소.
const CRAFT_TIER_WEIGHTS: Record<CraftTier, number> = {
  [-2]: 6,
  [-1]: 22,
  0: 44,
  1: 22,
  2: 6,
};
const CRAFT_TIER_WEIGHT_TOTAL = CRAFT_TIERS.reduce<number>(
  (sum, t) => sum + CRAFT_TIER_WEIGHTS[t],
  0,
);

export type CraftVariance = {
  /** 스탯별 ±폭 u. 등급 t 에 대해 bonus[stat] += t × u. */
  variance?: Partial<EquipBonus>;
  /** 스탯별 [불량,하급,일반,고급,걸작] 델타 직접 명시. 해당 스탯은 variance 보다 우선. */
  varianceTable?: Partial<
    Record<keyof EquipBonus, readonly [number, number, number, number, number]>
  >;
};

export function craftHasVariance(v: CraftVariance): boolean {
  if (v.variance && Object.values(v.variance).some((u) => !!u)) return true;
  if (v.varianceTable && Object.keys(v.varianceTable).length > 0) return true;
  return false;
}

// 가중 추첨. rng 는 [0,1) — 테스트에서 주입.
export function rollCraftTier(rng: () => number = Math.random): CraftTier {
  let r = rng() * CRAFT_TIER_WEIGHT_TOTAL;
  for (const t of CRAFT_TIERS) {
    r -= CRAFT_TIER_WEIGHTS[t];
    if (r < 0) return t;
  }
  return 0;
}

// 등급 t(−2..+2) → varianceTable 의 5칸 인덱스(0..4).
function tierIndex(tier: CraftTier): number {
  return tier + 2;
}

function tierBonusDelta(
  v: CraftVariance,
  key: keyof EquipBonus,
  tier: CraftTier,
): number {
  if (tier === 0) return 0;
  const table = v.varianceTable?.[key];
  if (table) return table[tierIndex(tier)] ?? 0;
  const u = v.variance?.[key];
  return u ? tier * u : 0;
}

// 베이스 EquipItem 의 stats 표시 문자열을 새 bonus 로 재생성. 라벨 순서/구성은 유지.
function rebuildStats(
  base: EquipItem,
  bonus: EquipBonus,
): { label: string; value: string }[] {
  const labelToKey = new Map<string, keyof EquipBonus>(
    BONUS_KEYS.map((k) => [BONUS_LABELS[k], k]),
  );
  return base.stats.map((s) => {
    const k = labelToKey.get(s.label);
    if (k == null) return s;
    return { label: s.label, value: signedBonus(bonus[k] ?? 0) };
  });
}

export type CraftedEquipItem = EquipItem & { craftTier: CraftTier };

// 베이스 EquipItem + variance 정의 + 등급 → bonus·stats 가 등급 반영된 새 EquipItem.
// craftTier 를 별도 필드로 달아 둔다(장착 슬롯/인벤 표시·역추적·재구성용).
export function applyCraftTier(
  base: EquipItem,
  v: CraftVariance,
  tier: CraftTier,
): CraftedEquipItem {
  if (tier === 0 || !craftHasVariance(v)) {
    return { ...base, craftTier: tier };
  }
  const baseBonus = base.bonus ?? {};
  const nextBonus: EquipBonus = { ...baseBonus };
  for (const k of BONUS_KEYS) {
    const delta = tierBonusDelta(v, k, tier);
    if (delta !== 0) nextBonus[k] = (baseBonus[k] ?? 0) + delta;
  }
  return { ...base, bonus: nextBonus, stats: rebuildStats(base, nextBonus), craftTier: tier };
}

// 장착/인벤 표시용 — "야구 방망이 ⟨걸작⟩" 의 " ⟨걸작⟩" 부분. 일반(0)/미지정이면 빈 문자열.
export function craftTierSuffix(tier: CraftTier | null | undefined): string {
  if (tier == null || tier === 0) return "";
  return ` ⟨${CRAFT_TIER_NAMES[tier]}⟩`;
}

// 등급별 텍스트 색 — rarity 와 별개 축(rarity 는 아이템 고유, tier 는 제작 롤).
export function craftTierTextClass(tier: CraftTier | null | undefined): string {
  switch (tier) {
    case -2:
      return "text-zinc-500 dark:text-zinc-500";
    case -1:
      return "text-zinc-500 dark:text-zinc-400";
    case 1:
      return "text-sky-600 dark:text-sky-400";
    case 2:
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-zinc-500 dark:text-zinc-400";
  }
}

// 대장간 카드용 — 변동 스탯의 범위 요약. "공격력 +6~+10" / 여러 개면 " · " join. 없으면 null.
export function craftVarianceSummary(
  base: EquipItem,
  v: CraftVariance,
): string | null {
  if (!craftHasVariance(v)) return null;
  const baseBonus = base.bonus ?? {};
  const parts: string[] = [];
  for (const k of BONUS_KEYS) {
    const table = v.varianceTable?.[k];
    const u = v.variance?.[k];
    if (table) {
      const lo = (baseBonus[k] ?? 0) + table[0];
      const hi = (baseBonus[k] ?? 0) + table[4];
      if (lo !== hi)
        parts.push(`${BONUS_LABELS[k]} ${signedBonus(lo)}~${signedBonus(hi)}`);
    } else if (u) {
      const cur = baseBonus[k] ?? 0;
      parts.push(
        `${BONUS_LABELS[k]} ${signedBonus(cur - 2 * u)}~${signedBonus(cur + 2 * u)}`,
      );
    }
  }
  return parts.length ? parts.join(" · ") : null;
}
