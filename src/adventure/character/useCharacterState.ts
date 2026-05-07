import { useEffect, useState } from "react";
import { CHARACTER_STATE_KEY } from "@/lib/storage-keys";
import { applyExpGain, MAX_LEVEL } from "@/lib/leveling";
import type { EquipItem } from "@/adventure/data/items";
import { baseCharacter } from "./defaults";
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
          equipped: parsed.equipped,
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

  const heal = () =>
    setState((prev) => ({
      ...prev,
      hp: baseCharacter.maxHp,
      mp: baseCharacter.maxMp,
    }));

  const restoreHpFull = () =>
    setState((prev) => ({ ...prev, hp: baseCharacter.maxHp }));

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
