// 인스턴스 기반 장비 풀 — 한 자루 한 자루 고유 ID 와 강화 단계를 들고 있다.
// 현재는 별빛 재단 무구 5종(ENHANCEABLE_ITEM_IDS) 만 인스턴스화. 그 외 장비는 기존
// 스택 (equipment[] / craftedEquipment[]) 그대로.
//
// craftTier 는 제작 variance 결과 (RECIPE.variance) — 정교한/빼어난 등급이 인스턴스
// 단위로 보존된다. 강화·등급 둘 다 한 자루 안에서 합쳐진다.

import type { CraftTier } from "@/adventure/data/craftQuality";
import type { ItemId } from "@/adventure/data/items";

export type EquipmentInstance = {
  /** 고유 ID. crypto.randomUUID 권장 (서버에서 생성). 절대 재사용 X. */
  instanceId: string;
  /** base 아이템. ENHANCEABLE_ITEM_IDS 안의 itemId 만 허용 (검증은 서버에서). */
  itemId: ItemId;
  /** 제작 등급. 미지정/0 = 일반. */
  craftTier?: CraftTier;
  /** 강화 단계 (0~ENHANCE_MAX_LEVEL). 0 = 미강화. */
  enhancementLevel: number;
};

// 인스턴스 ID 생성 — 서버/클라 모두 randomUUID 가 있으면 그걸, 없으면 fallback.
// 통상은 서버에서 발급되어 클라로 내려온다. 클라가 발급할 일은 없지만 헬퍼는 둔다.
export function generateInstanceId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback — 충돌 가능성 무시할 수준 (서버 권위로 검증되니까 문제 없음).
  return `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 저장된 raw 값을 EquipmentInstance 로 정규화. 잘못된 entry 는 drop.
// readInitial / 서버 readKv 에서 공유.
export function normalizeInstance(raw: unknown): EquipmentInstance | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<EquipmentInstance>;
  if (typeof r.instanceId !== "string" || !r.instanceId) return null;
  if (typeof r.itemId !== "string") return null;
  const lv = r.enhancementLevel;
  if (typeof lv !== "number" || !Number.isInteger(lv) || lv < 0) return null;
  const tier = r.craftTier;
  if (
    tier !== undefined &&
    tier !== 0 &&
    !(Number.isInteger(tier) && tier >= -2 && tier <= 2)
  ) {
    return null;
  }
  return {
    instanceId: r.instanceId,
    itemId: r.itemId as ItemId,
    craftTier: tier === 0 || tier === undefined ? undefined : (tier as CraftTier),
    enhancementLevel: lv,
  };
}

export function normalizeInstances(raw: unknown): EquipmentInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: EquipmentInstance[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const n = normalizeInstance(r);
    if (n && !seen.has(n.instanceId)) {
      out.push(n);
      seen.add(n.instanceId);
    }
  }
  return out;
}
