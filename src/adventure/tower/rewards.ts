// 고탑 첫 도달 마일스톤 보상 — 각 보스층(10/20/.../130) 첫 클리어 시 1회만 지급.
// PR-1 단계는 골드/재료만. 룬(PR-2) 는 보상 슬롯에 들어갈 자리만 비워둠.

import type { MaterialId } from "@/adventure/data/materials";

export type TowerMilestoneReward = {
  /** 클리어 시점에 캐릭터 골드에 합산. */
  gold?: number;
  /** 재료 인벤토리에 가산. */
  materials?: { id: MaterialId; count: number }[];
  /**
   * PR-2 룬 시스템 도입 시 채워 넣을 슬롯. 지금은 미사용 — 인터페이스만 깔아둠.
   * { runeId, count }[] 형태가 될 예정.
   */
  runes?: never;
};

// floor → reward. 정의되지 않은 보스층은 빈 보상(마일스톤 자체는 트리거되지만 지급할 게 없음).
// 후반 층일수록 골드/재료 양을 늘려 동기 부여.
export const TOWER_MILESTONES: Record<number, TowerMilestoneReward> = {
  10: { gold: 500 },
  20: { gold: 1000, materials: [{ id: "mana_dust", count: 30 }] },
  30: { gold: 2000, materials: [{ id: "mana_dust", count: 60 }] },
  40: { gold: 4000, materials: [{ id: "mana_crystal", count: 5 }] },
  50: { gold: 8000, materials: [{ id: "mana_crystal", count: 10 }] },
  60: { gold: 15000, materials: [{ id: "mana_crystal", count: 20 }] },
  70: { gold: 25000 },
  80: { gold: 40000 },
  90: { gold: 60000 },
  100: { gold: 100000 },
  110: { gold: 150000 },
  120: { gold: 250000 },
  130: { gold: 500000 },
};

/** 해당 층의 마일스톤 보상. 정의 안 된 층(보스층 아님 또는 빈 슬롯) 은 null. */
export function milestoneFor(floor: number): TowerMilestoneReward | null {
  return TOWER_MILESTONES[floor] ?? null;
}
