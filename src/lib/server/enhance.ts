// 별빛 재단 무구 강화 서버 lib — /api/enhance 의 핵심 로직.
//
// 권위: 서버. 클라는 instanceId 만 보내고, 서버가 inventory.v2 를 잠그고 검증·적용.
// 비용·단계 캡은 character/enhancement.ts 의 상수 그대로 — 클라/서버 동일 정책.
//
// 순수 계산(computeEnhanceOutcome)과 DB I/O(applyEnhanceAction) 를 분리해 단위 테스트.

import { and, eq } from "drizzle-orm";
import { savesKv } from "@/db/schema";
import { upsertSave, type DbExecutor } from "@/lib/server/savesKv";
import {
  ENHANCE_MAX_LEVEL,
  ENHANCE_SHARD_COST,
  isEnhanceable,
} from "@/adventure/character/enhancement";
import {
  normalizeInstances,
  type EquipmentInstance,
} from "@/adventure/inventory/equipmentInstances";

const SHARD_MATERIAL = "starfall_shard" as const;

export class EnhanceError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "EnhanceError";
  }
}

type CountMap = Record<string, number>;

export type EnhanceComputeInput = {
  materials: CountMap;
  equipmentInstances: EquipmentInstance[];
};

export type EnhanceComputeResult = {
  materials: CountMap;
  equipmentInstances: EquipmentInstance[];
  /** 적용 후 인스턴스의 새 단계. UI 알림에 사용. */
  toLevel: number;
  /** 차감된 별빛 조각 양. */
  shardsSpent: number;
};

// 순수 함수 — 인스턴스를 +1 단계 강화. 위반 시 EnhanceError throw.
export function computeEnhanceOutcome(
  input: EnhanceComputeInput,
  instanceId: string,
): EnhanceComputeResult {
  const idx = input.equipmentInstances.findIndex(
    (i) => i.instanceId === instanceId,
  );
  if (idx < 0) throw new EnhanceError("instance_not_found");
  const inst = input.equipmentInstances[idx];
  if (!isEnhanceable(inst.itemId)) {
    throw new EnhanceError("not_enhanceable");
  }
  if (inst.enhancementLevel >= ENHANCE_MAX_LEVEL) {
    throw new EnhanceError("max_level");
  }
  const toLevel = inst.enhancementLevel + 1;
  const cost = ENHANCE_SHARD_COST[toLevel] ?? 0;
  const have = input.materials[SHARD_MATERIAL] ?? 0;
  if (have < cost) throw new EnhanceError("insufficient_shards");

  const materials: CountMap = { ...input.materials };
  const left = have - cost;
  if (left > 0) materials[SHARD_MATERIAL] = left;
  else delete materials[SHARD_MATERIAL];
  const updated: EquipmentInstance = {
    ...inst,
    enhancementLevel: toLevel,
  };
  const equipmentInstances = [
    ...input.equipmentInstances.slice(0, idx),
    updated,
    ...input.equipmentInstances.slice(idx + 1),
  ];
  return { materials, equipmentInstances, toLevel, shardsSpent: cost };
}

// ─────────────────────────────────────────────────────────────────────

type SavedInventory = {
  materials?: CountMap;
  equipmentInstances?: unknown;
  [k: string]: unknown;
};

async function readKv<T>(
  tx: DbExecutor,
  userId: string,
  key: string,
): Promise<T | null> {
  const rows = await tx
    .select()
    .from(savesKv)
    .where(and(eq(savesKv.userId, userId), eq(savesKv.key, key)))
    .for("update");
  return (rows[0]?.value as T | undefined) ?? null;
}

export type EnhanceOutcome = {
  inventory: SavedInventory;
  toLevel: number;
  shardsSpent: number;
};

// 트랜잭션 안에서 호출. inventory.v2 잠금 → 검증 → 적용.
export async function applyEnhanceAction(
  tx: DbExecutor,
  userId: string,
  instanceId: string,
): Promise<EnhanceOutcome> {
  const inv = (await readKv<SavedInventory>(tx, userId, "inventory.v2")) ?? {};
  const out = computeEnhanceOutcome(
    {
      materials: { ...(inv.materials ?? {}) },
      equipmentInstances: normalizeInstances(inv.equipmentInstances),
    },
    instanceId,
  );
  const newInventory: SavedInventory = {
    ...inv,
    materials: out.materials,
    equipmentInstances: out.equipmentInstances,
  };
  await upsertSave(tx, userId, "inventory.v2", newInventory);
  return {
    inventory: newInventory,
    toLevel: out.toLevel,
    shardsSpent: out.shardsSpent,
  };
}
