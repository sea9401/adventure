// 드랍 품질 등급 — 몬스터·보스가 떨구는 장비에만 적용. 위로만 굴린다.
//
// 3단계: 기본(접두어 없음, 0) / 정교한(+1u, 1) / 빼어난(+2u, 2). 하향 롤 없음 —
// 드랍률 게이트를 이미 통과했으므로 추가 하향은 이중 처벌. 제작 등급(불량/하급/일반/고급/걸작,
// craftQuality.ts)과는 별개 명칭·별개 인벤 칸(droppedEquipment).
//
// 가중치: raw 95/4/1. monster.dropQualityBias(기본 1)가 비-기본 등급(1·2) 가중치에 곱해진 뒤
// 정규화 — 보스/고티어는 bias 2~4 로 좋은 품질이 더 잘 나온다.
//
// 표시값(아이템 카드의 stats) = 기본 등급 = 최저 보장치. 드랍산은 표시값=하한, 제작산은
// 표시값=평균 — 의도된 비대칭.
//
// variance 기본 규칙: u=1, 그 아이템의 "주력 양수 스탯"에 +q×1. 별도 데이터 불필요.
// 특수 아이템만 EquipItem.dropVariance(CraftVariance 와 같은 형태) 로 override —
// varianceTable 의 5칸 중 [2,3,4](일반/고급/걸작 칸)를 드랍 등급 0/1/2 로 재사용한다.

import {
  BONUS_KEYS,
  BONUS_LABELS,
  ITEMS,
  signedBonus,
  type EquipBonus,
  type EquipItem,
  type ItemId,
} from "./items";
import { craftHasVariance, type CraftVariance } from "./craftQuality";

export type DropQuality = 0 | 1 | 2; // 기본 / 정교한 / 빼어난

// 0(기본)을 제외한 "비-기본" 등급 — droppedEquipment 인벤토리는 이 2종만 담는다.
export const NON_ZERO_DROP_QUALITIES: readonly DropQuality[] = [1, 2];
export const NON_ZERO_DROP_QUALITY_KEYS: readonly string[] = ["1", "2"];

export const DROP_QUALITY_NAMES: Record<DropQuality, string> = {
  0: "",
  1: "정교한",
  2: "빼어난",
};

// raw 가중치. bias 가 비-기본 등급(1·2)에만 곱해진 뒤 합으로 정규화된다.
const DROP_QUALITY_WEIGHTS: Record<DropQuality, number> = { 0: 95, 1: 4, 2: 1 };

// 가중 추첨 — 서버(위탁, seeded rng) / 클라(라이브, Math.random) 양쪽에서 호출.
// bias(기본 1): 비-기본 등급(1·2) 가중치 배수. 보스·고티어 몬스터는 monster.dropQualityBias 를 넘긴다.
export function rollDropQuality(
  rng: () => number = Math.random,
  bias = 1,
): DropQuality {
  const b = Number.isFinite(bias) && bias > 0 ? bias : 1;
  const w0 = DROP_QUALITY_WEIGHTS[0];
  const w1 = DROP_QUALITY_WEIGHTS[1] * b;
  const w2 = DROP_QUALITY_WEIGHTS[2] * b;
  let r = rng() * (w0 + w1 + w2);
  r -= w0;
  if (r < 0) return 0;
  r -= w1;
  if (r < 0) return 1;
  return 2;
}

// 주력 양수 스탯 — bonus 의 최대 양수 항목. 동률이면 슬롯 기본(weapon→atk, armor→def),
// 그래도 동률이면 BONUS_KEYS 순. 양수 보너스가 없으면 null → 그 장비는 항상 기본 등급.
export function primaryPositiveStat(item: EquipItem): keyof EquipBonus | null {
  const bonus = item.bonus ?? {};
  const slotDefault: keyof EquipBonus | null =
    item.slot === "weapon" ? "atk" : item.slot === "armor" ? "def" : null;
  let best: keyof EquipBonus | null = null;
  for (const k of BONUS_KEYS) {
    const v = bonus[k] ?? 0;
    if (v <= 0) continue;
    if (best == null) {
      best = k;
      continue;
    }
    const bv = bonus[best] ?? 0;
    if (v > bv) best = k;
    else if (v === bv && k === slotDefault) best = k;
  }
  return best;
}

// 드랍 등급 q(0/1/2) → 스탯 델타. v.varianceTable[k] 는 5칸 — 드랍은 그 중 [2,3,4]
// (일반/고급/걸작 칸)를 0/1/2 등급으로 재사용. v.variance[k] 는 폭 u → delta = q×u.
function dropBonusDelta(
  v: CraftVariance,
  key: keyof EquipBonus,
  q: DropQuality,
): number {
  if (q === 0) return 0;
  const table = v.varianceTable?.[key];
  if (table) return table[q + 2] ?? 0;
  const u = v.variance?.[key];
  return u ? q * u : 0;
}

// 베이스 EquipItem 의 stats 표시 문자열을 새 bonus 로 재생성. 라벨 순서/구성은 유지.
// (craftQuality 의 rebuildStats 와 동일 로직 — 작아서 중복 허용; 통합은 후속.)
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

export type DroppedEquipItem = EquipItem & { dropQuality: DropQuality };

// 베이스 + 품질 → bonus·stats 가 등급 반영된 사본(+ dropQuality 마커).
// dropVariance override 가 없으면 "주력 양수 스탯 +q×1" 기본 규칙. 주력 양수 스탯이 없거나
// 변동 정의가 비면 베이스 그대로(+ 마커). q===0 이면 변동 없음.
export function applyDropQuality(
  base: EquipItem,
  q: DropQuality,
): DroppedEquipItem {
  if (q === 0) return { ...base, dropQuality: 0 };
  let v: CraftVariance | undefined = base.dropVariance;
  if (!v) {
    const stat = primaryPositiveStat(base);
    v = stat ? { variance: { [stat]: 1 } } : {};
  }
  if (!craftHasVariance(v)) return { ...base, dropQuality: q };
  const baseBonus = base.bonus ?? {};
  const nextBonus: EquipBonus = { ...baseBonus };
  for (const k of BONUS_KEYS) {
    const delta = dropBonusDelta(v, k, q);
    if (delta !== 0) nextBonus[k] = (baseBonus[k] ?? 0) + delta;
  }
  return {
    ...base,
    bonus: nextBonus,
    stats: rebuildStats(base, nextBonus),
    dropQuality: q,
  };
}

// 드랍산 등급 인스턴스(itemId + 등급) → 등급 반영된 EquipItem(+ dropQuality 마커).
export function resolveDroppedItem(
  itemId: ItemId,
  q: DropQuality,
): DroppedEquipItem {
  return applyDropQuality(ITEMS[itemId], q);
}

// "1" / "2" 같은 키 문자열 → 유효한 비-기본 DropQuality, 아니면 null.
export function parseDropQuality(v: unknown): DropQuality | null {
  const n = typeof v === "number" ? v : Number(v);
  return n === 1 || n === 2 ? (n as DropQuality) : null;
}

// 이름 앞 prefix — "정교한 " / "빼어난 ". 기본(0)/미지정이면 빈 문자열. (제작산은 suffix, 드랍산은 prefix.)
export function dropQualityPrefix(q: DropQuality | null | undefined): string {
  if (!q) return "";
  const name = DROP_QUALITY_NAMES[q];
  return name ? `${name} ` : "";
}

// 등급별 텍스트 색 — rarity / craftTier 와 안 겹치게: 1=teal, 2=amber.
export function dropQualityTextClass(q: DropQuality | null | undefined): string {
  switch (q) {
    case 1:
      return "text-teal-600 dark:text-teal-400";
    case 2:
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-zinc-500 dark:text-zinc-400";
  }
}
