// 고탑 서버측 적용 — DB 트랜잭션 안에서 tower.v1 / character.v2 / inventory.v2 잠금 +
// computeTowerOutcome 로 새 상태 산출 → 갱신.
//
// PR-1b 의 단순화: fight_floor 의 win/lose 판정은 클라이언트 보고를 신뢰한다.
// 다음 단계(Phase 2 또는 별도 PR)에서 서버측 battle resolution 으로 교체 예정.
//
// 머지 안내: 머지된 상태는 인벤토리/캐릭터 v2 와의 동시 갱신을 한 트랜잭션 안에서 처리해야
// 마일스톤 보상 분실/이중 수령을 막을 수 있다.

import { and, eq } from "drizzle-orm";
import { savesKv } from "@/db/schema";
import { upsertSave, type DbExecutor } from "@/lib/server/savesKv";
import { TOWER_STORAGE_KEY, type TowerState } from "@/adventure/tower/types";
import {
  TowerError,
  computeTowerOutcome,
  todayKey,
  type TowerAction,
  type TowerApplied,
  type TowerComputeResult,
} from "./compute";

type SavedCharacter = { gold?: number; [k: string]: unknown };
type CountMap = Record<string, number>;
type SavedInventory = { materials?: CountMap; [k: string]: unknown };

const EMPTY_STATE: TowerState = {
  progress: { highestFloor: 0, claimedMilestones: [] },
  run: null,
  daily: null,
};

async function readKv<T>(
  tx: DbExecutor,
  userId: string,
  key: string,
  lock: boolean,
): Promise<T | null> {
  const q = tx
    .select({ value: savesKv.value })
    .from(savesKv)
    .where(and(eq(savesKv.userId, userId), eq(savesKv.key, key)));
  const rows = lock ? await q.for("update") : await q.limit(1);
  return (rows[0]?.value as T | undefined) ?? null;
}

export type TowerOutcome = {
  tower: TowerState;
  /** 마일스톤 보상으로 갱신된 character.v2 (없으면 미동봉). */
  character?: SavedCharacter;
  /** 마일스톤 보상으로 갱신된 inventory.v2 (없으면 미동봉). */
  inventory?: SavedInventory;
  applied: TowerApplied;
};

/** 트랜잭션 안에서 호출. tower.v1 잠금 + (필요 시) character.v2 / inventory.v2 갱신. */
export async function applyTowerAction(
  tx: DbExecutor,
  userId: string,
  action: TowerAction,
): Promise<TowerOutcome> {
  const state =
    (await readKv<TowerState>(tx, userId, TOWER_STORAGE_KEY, true)) ?? EMPTY_STATE;

  const result: TowerComputeResult = computeTowerOutcome(
    { state, today: todayKey() },
    action,
  );

  await upsertSave(tx, userId, TOWER_STORAGE_KEY, result.state);

  // 마일스톤 보상 적용 — gold 가 있으면 character.v2 갱신, materials 가 있으면 inventory.v2 갱신.
  let character: SavedCharacter | undefined;
  let inventory: SavedInventory | undefined;

  const milestone = result.applied.milestone;
  if (milestone) {
    const reward = milestone.reward;

    if ((reward.gold ?? 0) > 0) {
      const cur = (await readKv<SavedCharacter>(tx, userId, "character.v2", true)) ?? {};
      character = { ...cur, gold: (cur.gold ?? 0) + (reward.gold ?? 0) };
      await upsertSave(tx, userId, "character.v2", character);
    }

    if (reward.materials && reward.materials.length > 0) {
      const cur = (await readKv<SavedInventory>(tx, userId, "inventory.v2", true)) ?? {};
      const materials: CountMap = { ...(cur.materials ?? {}) };
      for (const m of reward.materials) {
        materials[m.id] = (materials[m.id] ?? 0) + m.count;
      }
      inventory = { ...cur, materials };
      await upsertSave(tx, userId, "inventory.v2", inventory);
    }
  }

  return { tower: result.state, character, inventory, applied: result.applied };
}

export { TowerError };
