import { useState } from "react";
import { applyExpGain, MAX_LEVEL } from "@/lib/leveling";
import { ITEMS, findItemId, type EquipItem } from "@/adventure/data/items";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import { baseCharacter, maxHpForLevel, maxMpForLevel } from "./defaults";
import type { EquippedSlots } from "./types";

export type CharacterDynamicState = {
  hp: number;
  mp: number;
  level: number;
  exp: number;
  gold: number;
  fame: number;
  equipped?: EquippedSlots;
};

export const initialCharacterState: CharacterDynamicState = {
  hp: 47,
  mp: 30,
  level: 1,
  exp: 0,
  gold: 10,
  fame: 0,
};

// 저장된 EquipItem(이름·stats·bonus 통째로 직렬화)을 ITEMS 정의의 "지금" 인스턴스로 교체.
// 이렇게 하지 않으면 밸런스 패치(예: 부적 행운 +3 → +2) 후에도 옛 인스턴스가 그대로 보인다.
// 이름 매칭이 안 되면 null — 슬롯에서 사라짐.
function rehydrateSlot(saved: EquipItem | null | undefined): EquipItem | null {
  if (!saved) return null;
  const id = findItemId(saved);
  return id ? ITEMS[id] : null;
}

function rehydrateEquipped(
  saved: CharacterDynamicState["equipped"],
): CharacterDynamicState["equipped"] {
  if (!saved) return undefined;
  return {
    weapon: rehydrateSlot(saved.weapon),
    armor: rehydrateSlot(saved.armor),
    accessory: rehydrateSlot(saved.accessory),
  };
}

function readInitial(raw: unknown): CharacterDynamicState {
  if (!raw || typeof raw !== "object") return initialCharacterState;
  const parsed = raw as Partial<CharacterDynamicState>;
  return {
    hp: parsed.hp ?? initialCharacterState.hp,
    mp: parsed.mp ?? initialCharacterState.mp,
    level: Math.min(
      MAX_LEVEL,
      Math.max(1, parsed.level ?? initialCharacterState.level),
    ),
    exp: parsed.exp ?? initialCharacterState.exp,
    gold: parsed.gold ?? initialCharacterState.gold,
    fame: parsed.fame ?? initialCharacterState.fame,
    equipped: rehydrateEquipped(parsed.equipped),
  };
}

export function useCharacterState() {
  const initial = useSavedValue("character.v2");
  const [state, setState] = useState<CharacterDynamicState>(() =>
    readInitial(initial),
  );
  useRemotePatch("character.v2", state);

  const equippedSlots = state.equipped ?? baseCharacter.equipped;

  // maxHp/maxMp는 호출 측이 스탯(VIT 등) 보정을 합쳐 넘겨주면 그 값으로 회복.
  // 미지정이면 레벨 기준만 사용 (스탯 보정 없는 레거시 동작).
  const heal = (cost = 0, maxHp?: number, maxMp?: number) =>
    setState((prev) => ({
      ...prev,
      gold: Math.max(0, prev.gold - cost),
      hp: maxHp ?? maxHpForLevel(prev.level),
      mp: maxMp ?? maxMpForLevel(prev.level),
    }));

  const restoreHpFull = (maxHp?: number) =>
    setState((prev) => ({ ...prev, hp: maxHp ?? maxHpForLevel(prev.level) }));

  const setHp = (hp: number) => setState((prev) => ({ ...prev, hp }));

  const addGoldFame = (gold: number, fame: number) =>
    setState((prev) => ({
      ...prev,
      gold: prev.gold + gold,
      fame: prev.fame + fame,
    }));

  const addGold = (delta: number) =>
    setState((prev) => ({ ...prev, gold: prev.gold + delta }));

  // vitHpBonus: 레벨업 풀회복 시 VIT(스탯+장비) 보너스만큼 maxHp에 더해 회복.
  // 기본 0 — 호출 측에서 안 넘기면 레벨 기준 max 까지만 회복 (퀘스트 보상 등).
  const addExp = (n: number, vitHpBonus = 0) =>
    setState((prev) => {
      const next = applyExpGain(prev.level, prev.exp, n);
      // 레벨업 시 HP/MP 를 새 max 로 풀회복 — 보상감 + max 증가만 했을 때 발생하는
      // "현재값이 max 보다 낮은 채 정체" 문제 회피.
      if (next.levelsGained > 0) {
        return {
          ...prev,
          level: next.level,
          exp: next.exp,
          hp: maxHpForLevel(next.level) + vitHpBonus,
          mp: maxMpForLevel(next.level),
        };
      }
      return { ...prev, level: next.level, exp: next.exp };
    });

  const setSlot = (slot: keyof EquippedSlots, item: EquipItem | null) =>
    setState((prev) => {
      const current = prev.equipped ?? baseCharacter.equipped;
      return { ...prev, equipped: { ...current, [slot]: item } };
    });

  return {
    state,
    hydrated: true,
    equippedSlots,
    heal,
    restoreHpFull,
    setHp,
    addGold,
    addGoldFame,
    addExp,
    setSlot,
  };
}
