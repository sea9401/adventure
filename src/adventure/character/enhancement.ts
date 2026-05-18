// 별빛 재단 무구 강화 — 5막 종착 후 풀리는 영구 sink.
//
// 별빛 재단 무구 5종 한정. empyrean 이하 일반 장비는 강화 불가 (사다리 흐려지지 않게).
// 인스턴스 기반 — 한 자루 한 자루가 고유 ID 와 enhancementLevel(0~5) 을 들고 있다.
// 비용: 별빛 조각 누진 — 자루당 +5 풀강 590개, 5종 풀세트 +5 = 2950개.
//
// 단계당 보너스:
//   무기 4종 — atk +1, 주능력치(검=str/방패=vit/창=dex/너클=luk) +1
//   망토 1종 — dex +1, spd +1
//
// 실패 확률 없음 — 비용 누진만으로 페이스 조절.

import { BONUS_KEYS, ITEMS, type EquipBonus, type ItemId } from "@/adventure/data/items";
import {
  rebuildStats,
  type CraftTier,
} from "@/adventure/data/craftQuality";
import { resolveCraftedItem } from "@/adventure/data/recipes";
import type { EquippedItem } from "./types";

export const ENHANCE_MAX_LEVEL = 5;

// 별빛 조각 누진 비용 — index = 도달 단계. 0 단계는 비용 없음(초기 상태).
export const ENHANCE_SHARD_COST: readonly number[] = [0, 30, 60, 100, 150, 250];

// 자루당 풀강 누적 비용 — 30 + 60 + 100 + 150 + 250 = 590.
export const ENHANCE_FULL_COST = ENHANCE_SHARD_COST.reduce((a, b) => a + b, 0);

// 강화 가능한 itemId 들과 단계당 보너스. 새 강화 라인 추가 시 여기에 한 줄.
const ENHANCE_PER_LEVEL: Partial<Record<ItemId, EquipBonus>> = {
  starlit_blade: { atk: 1, str: 1 },
  starlit_aegis: { atk: 1, vit: 1 },
  starlit_lance: { atk: 1, dex: 1 },
  starlit_grip: { atk: 1, luk: 1 },
  starlit_mantle: { dex: 1, spd: 1 },
};

// 강화 가능한 itemId 집합 — 인스턴스 기반 저장 대상.
export const ENHANCEABLE_ITEM_IDS: ReadonlySet<ItemId> = new Set(
  Object.keys(ENHANCE_PER_LEVEL) as ItemId[],
);

export function isEnhanceable(itemId: ItemId): boolean {
  return ENHANCEABLE_ITEM_IDS.has(itemId);
}

// 강화 N 단계의 누적 보너스 — level 0 이면 빈 보너스.
// 보너스 키별로 (per-level 값 × level) 누적.
export function enhancementBonus(
  itemId: ItemId,
  level: number,
): EquipBonus {
  const per = ENHANCE_PER_LEVEL[itemId];
  if (!per || level <= 0) return {};
  const out: EquipBonus = {};
  for (const k of Object.keys(per) as (keyof EquipBonus)[]) {
    const v = per[k];
    if (typeof v === "number" && v !== 0) out[k] = v * level;
  }
  return out;
}

// 다음 강화 한 단계의 비용. 최대 단계면 null.
export function nextEnhanceCost(
  fromLevel: number,
): { toLevel: number; shards: number } | null {
  if (!Number.isInteger(fromLevel) || fromLevel < 0) return null;
  const to = fromLevel + 1;
  if (to > ENHANCE_MAX_LEVEL) return null;
  return { toLevel: to, shards: ENHANCE_SHARD_COST[to] ?? 0 };
}

export type EnhanceErrorCode =
  | "not_enhanceable" // itemId 가 강화 대상 아님
  | "max_level" // 이미 최대 단계
  | "insufficient_shards" // 별빛 조각 부족
  | "invalid_level"; // fromLevel 이 음수/비정수

export type EnhancePlan =
  | { ok: true; toLevel: number; shards: number }
  | { ok: false; reason: EnhanceErrorCode };

// 인스턴스의 (itemId, craftTier, enhancementLevel) 로부터 장착 가능한 EquippedItem 을 만든다.
// craftTier 가 우선 적용된 베이스 위에 강화 보너스를 더하고, stats 표시도 재생성.
// instanceId 를 받아 EquippedItem 의 instanceId 필드에 박는다 — 슬롯 회수 시 풀로 돌려놓는 키.
export function resolveEnhancedItem(
  itemId: ItemId,
  craftTier: CraftTier | undefined,
  enhancementLevel: number,
  instanceId: string,
): EquippedItem {
  const base = ITEMS[itemId];
  // 제작 등급 먼저 적용 (강화 위에). craftTier 0/미지정이면 베이스 그대로.
  const tiered =
    craftTier != null && craftTier !== 0
      ? resolveCraftedItem(itemId, craftTier)
      : { ...base };
  if (enhancementLevel <= 0) {
    return {
      ...tiered,
      craftTier,
      enhancementLevel: 0,
      instanceId,
    };
  }
  const tierBonus = tiered.bonus ?? {};
  const enhBonus = enhancementBonus(itemId, enhancementLevel);
  const merged: EquipBonus = { ...tierBonus };
  for (const k of BONUS_KEYS) {
    const e = enhBonus[k];
    if (typeof e === "number" && e !== 0) {
      merged[k] = (merged[k] ?? 0) + e;
    }
  }
  return {
    ...tiered,
    bonus: merged,
    stats: rebuildStats(base, merged),
    craftTier,
    enhancementLevel,
    instanceId,
  };
}

// 한 자루 +1 강화의 유효성·비용 사전 검사. UI 에서 미리보기·검증에 쓴다.
// 실제 적용은 서버 endpoint 가 같은 검사를 다시 한다.
export function planEnhance(
  itemId: ItemId,
  fromLevel: number,
  shardCount: number,
): EnhancePlan {
  if (!isEnhanceable(itemId)) return { ok: false, reason: "not_enhanceable" };
  if (!Number.isInteger(fromLevel) || fromLevel < 0) {
    return { ok: false, reason: "invalid_level" };
  }
  const cost = nextEnhanceCost(fromLevel);
  if (!cost) return { ok: false, reason: "max_level" };
  if (shardCount < cost.shards) {
    return { ok: false, reason: "insufficient_shards" };
  }
  return { ok: true, toLevel: cost.toLevel, shards: cost.shards };
}
