import { ITEMS, type EquipItem, type EquipTier, type ItemId } from "@/adventure/data/items";

// 진행 구간 5단계 — 인벤·도감·대장간이 공통으로 쓰는 그룹 키.
// 미지정 장비는 1 ("입문") 로 fallback — 초반 잡템·tier 안 적은 신규 장비가 여기로 모임.
export const EQUIP_TIER_FALLBACK: EquipTier = 1;

export type EquipTierMeta = {
  tier: EquipTier;
  // 헤더 한글명.
  label: string;
  // 헤더 옆 부제 — 대표 지역/레벨대 힌트.
  hint: string;
};

export const EQUIP_TIER_METAS: readonly EquipTierMeta[] = [
  { tier: 1, label: "입문", hint: "시작 마을 ~ 디올라 · 1~15" },
  { tier: 2, label: "정착", hint: "산기슭 ~ 운향 · 15~30" },
  { tier: 3, label: "다리 구간", hint: "운저 평원 ~ 잿빛 협로 · 30~45" },
  { tier: 4, label: "봉황·화산", hint: "봉황령 ~ 화산 · 45~60" },
  { tier: 5, label: "엔드", hint: "천공 ~ 만렙 후 · 60+" },
] as const;

const TIER_META_BY_KEY: Record<EquipTier, EquipTierMeta> = Object.fromEntries(
  EQUIP_TIER_METAS.map((m) => [m.tier, m]),
) as Record<EquipTier, EquipTierMeta>;

export function tierMeta(tier: EquipTier): EquipTierMeta {
  return TIER_META_BY_KEY[tier];
}

// 장비의 tier — items.ts 에 명시된 값, 없으면 fallback.
// id 가 ITEMS 에 없으면 (orphan / 동적 생성 등) 도 fallback.
export function getItemTier(idOrItem: ItemId | EquipItem | null | undefined): EquipTier {
  if (!idOrItem) return EQUIP_TIER_FALLBACK;
  const item: EquipItem | undefined =
    typeof idOrItem === "string"
      ? (ITEMS[idOrItem as keyof typeof ITEMS] as EquipItem | undefined)
      : idOrItem;
  return item?.tier ?? EQUIP_TIER_FALLBACK;
}

// 검색 쿼리(부분 일치) — 공백 trim, 소문자/한글 그대로 substring.
// 빈 문자열이면 항상 true(필터 비활성).
export function matchesEquipQuery(item: EquipItem | null | undefined, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (!item) return false;
  const hay = `${item.name} ${item.description ?? ""}`;
  return hay.toLowerCase().includes(q.toLowerCase());
}

// 임의 entry 배열을 tier 별로 묶어 [{ tier, meta, entries }] 로 반환.
// 빈 tier 는 생략. tier 오름차순 정렬.
export function groupByTier<T>(
  entries: readonly T[],
  getTier: (entry: T) => EquipTier,
): Array<{ tier: EquipTier; meta: EquipTierMeta; entries: T[] }> {
  const buckets = new Map<EquipTier, T[]>();
  for (const e of entries) {
    const t = getTier(e);
    let arr = buckets.get(t);
    if (!arr) {
      arr = [];
      buckets.set(t, arr);
    }
    arr.push(e);
  }
  return EQUIP_TIER_METAS.flatMap((meta) => {
    const arr = buckets.get(meta.tier);
    if (!arr || arr.length === 0) return [];
    return [{ tier: meta.tier, meta, entries: arr }];
  });
}
