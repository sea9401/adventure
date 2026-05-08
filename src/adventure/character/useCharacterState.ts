import { useEffect, useState } from "react";
import { CHARACTER_STATE_KEY } from "@/lib/storage-keys";
import { applyExpGain, MAX_LEVEL } from "@/lib/leveling";
import { ITEMS, findItemId, type EquipItem } from "@/adventure/data/items";
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
  hp: 50,
  mp: 30,
  level: 1,
  exp: 0,
  gold: 0,
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

export function useCharacterState() {
  const [state, setState] =
    useState<CharacterDynamicState>(initialCharacterState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHARACTER_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CharacterDynamicState>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({
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
        });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CHARACTER_STATE_KEY, JSON.stringify(state));
    } catch {}
  }, [hydrated, state]);

  const equippedSlots = state.equipped ?? baseCharacter.equipped;

  const heal = (cost = 0) =>
    setState((prev) => ({
      ...prev,
      gold: Math.max(0, prev.gold - cost),
      hp: maxHpForLevel(prev.level),
      mp: maxMpForLevel(prev.level),
    }));

  const restoreHpFull = () =>
    setState((prev) => ({ ...prev, hp: maxHpForLevel(prev.level) }));

  const setHp = (hp: number) => setState((prev) => ({ ...prev, hp }));

  const addGoldFame = (gold: number, fame: number) =>
    setState((prev) => ({
      ...prev,
      gold: prev.gold + gold,
      fame: prev.fame + fame,
    }));

  const addGold = (delta: number) =>
    setState((prev) => ({ ...prev, gold: prev.gold + delta }));

  const addExp = (n: number) =>
    setState((prev) => {
      const next = applyExpGain(prev.level, prev.exp, n);
      // 레벨업 시 HP/MP 를 새 max 로 풀회복 — 보상감 + max 증가만 했을 때 발생하는
      // "현재값이 max 보다 낮은 채 정체" 문제 회피.
      if (next.levelsGained > 0) {
        return {
          ...prev,
          level: next.level,
          exp: next.exp,
          hp: maxHpForLevel(next.level),
          mp: maxMpForLevel(next.level),
        };
      }
      return { ...prev, level: next.level, exp: next.exp };
    });

  const setSlot = (slot: keyof EquippedSlots, item: EquipItem) =>
    setState((prev) => {
      const current = prev.equipped ?? baseCharacter.equipped;
      return { ...prev, equipped: { ...current, [slot]: item } };
    });

  return {
    state,
    hydrated,
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
