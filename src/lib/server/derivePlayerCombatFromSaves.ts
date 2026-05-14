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
import { rehydrateEquippedItem } from "@/adventure/character/rehydrateEquip";
import type { EquippedItem } from "@/adventure/character/types";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { STORY_FLAGS_STORAGE_KEY } from "@/adventure/storyFlags/storage";

type SavedEquipped = {
  weapon?: EquippedItem | null;
  armor?: EquippedItem | null;
  accessory?: EquippedItem | null;
};

type SavedCharacterV2 = {
  hp?: number;
  level?: number;
  equipped?: SavedEquipped | null;
  equippedSkills?: string[];
  /** 신 포맷 — 슬롯 인덱스 별 특기. */
  equippedFeats?: (string | null)[];
  /** 레거시 — 단일 특기 슬롯 시절 필드. 읽기 호환만. */
  equippedFeat?: string;
};

type SavedTrainingV2 = {
  allocated?: Partial<Record<StatKey, number>>;
};

type SavedStoryFlagsV2 = {
  flags?: string[];
};

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
  const storyFlags =
    (await readSave<SavedStoryFlagsV2>(userId, STORY_FLAGS_STORAGE_KEY)) ?? {};
  const storyFlagIds = new Set(
    Array.isArray(storyFlags.flags) ? storyFlags.flags : [],
  );

  const allocatedStats: Record<StatKey, number> = STAT_KEYS.reduce(
    (acc, k) => {
      acc[k] = training.allocated?.[k] ?? 0;
      return acc;
    },
    { str: 0, dex: 0, vit: 0, spd: 0, luk: 0 } as Record<StatKey, number>,
  );

  // ⚠️ 반드시 craftTier/dropQuality 까지 반영하는 공용 헬퍼를 써야 한다 — 베이스 아이템만
  // 돌려주면 걸작/빼어난 장비 보너스가 사라져 feat 임계치 위에 있던 빌드가 침묵 비활성화됨.
  const savedEquipped = character.equipped ?? null;
  const equipped = {
    weapon: rehydrateEquippedItem(savedEquipped?.weapon),
    armor: rehydrateEquippedItem(savedEquipped?.armor),
    accessory: rehydrateEquippedItem(savedEquipped?.accessory),
  };

  // 레거시 equippedFeat (단일 string) → 배열 정규화. 클라이언트 readInitial 과 동일.
  const equippedFeats =
    character.equippedFeats ??
    (character.equippedFeat ? [character.equippedFeat] : undefined);

  return derivePlayerCombat({
    level: character.level ?? 1,
    baseStats: baseCharacter.stats,
    allocatedStats,
    equipped,
    equippedSkills: character.equippedSkills,
    equippedFeats,
    storyFlagIds,
    hp: character.hp ?? baseCharacter.hp,
  });
}
