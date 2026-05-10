// 서버측 PlayerCombat 재계산 — 저장된 character.v2 + training.v2 를 읽어 같은 derive 를 돌린다.
// 협동 보스 등 신뢰가 필요한 경로에서 클라가 보낸 PlayerCombat 을 무시하고 이 결과를 사용.

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savesKv } from "@/db/schema";
import { baseCharacter } from "@/adventure/character/defaults";
import {
  derivePlayerCombat,
  type DerivedPlayerCombat,
} from "@/adventure/character/derivePlayerCombat";
import { ITEMS, findItemId, type EquipItem } from "@/adventure/data/items";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";

type SavedEquipped = {
  weapon?: EquipItem | null;
  armor?: EquipItem | null;
  accessory?: EquipItem | null;
};

type SavedCharacterV2 = {
  hp?: number;
  level?: number;
  equipped?: SavedEquipped | null;
  equippedSkills?: string[];
};

type SavedTrainingV2 = {
  allocated?: Partial<Record<StatKey, number>>;
};

// 저장된 EquipItem 직렬화를 ITEMS 정의의 현재 인스턴스로 교체.
// useCharacterState.ts 의 rehydrateSlot 과 동일 — 밸런스 패치 후에도 옛 인스턴스가 안 남도록.
function rehydrateSlot(saved: EquipItem | null | undefined): EquipItem | null {
  if (!saved) return null;
  const id = findItemId(saved);
  return id ? ITEMS[id] : null;
}

async function readSave<T>(userId: string, key: string): Promise<T | null> {
  const rows = await db
    .select({ value: savesKv.value })
    .from(savesKv)
    .where(and(eq(savesKv.userId, userId), eq(savesKv.key, key)))
    .limit(1);
  return (rows[0]?.value as T | undefined) ?? null;
}

export async function derivePlayerCombatFromSaves(
  userId: string,
): Promise<DerivedPlayerCombat | null> {
  const character = await readSave<SavedCharacterV2>(userId, "character.v2");
  if (!character) return null;

  const training =
    (await readSave<SavedTrainingV2>(userId, "training.v2")) ?? {};

  const allocatedStats: Record<StatKey, number> = STAT_KEYS.reduce(
    (acc, k) => {
      acc[k] = training.allocated?.[k] ?? 0;
      return acc;
    },
    { str: 0, dex: 0, vit: 0, spd: 0, luk: 0 } as Record<StatKey, number>,
  );

  const savedEquipped = character.equipped ?? null;
  const equipped = {
    weapon: rehydrateSlot(savedEquipped?.weapon),
    armor: rehydrateSlot(savedEquipped?.armor),
    accessory: rehydrateSlot(savedEquipped?.accessory),
  };

  return derivePlayerCombat({
    level: character.level ?? 1,
    baseStats: baseCharacter.stats,
    allocatedStats,
    equipped,
    equippedSkills: character.equippedSkills,
    hp: character.hp ?? baseCharacter.hp,
  });
}
