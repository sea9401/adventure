import type { ElementBuff, ElementKind, ElementState } from "../types";
import {
  ELEMENT_BUFFS,
  ELEMENT_COMBO_EFFECTS,
  ELEMENT_LINGER_TURNS,
  ELEMENT_STACK_CAP,
} from "../data";

export const initElementState = (): ElementState => ({
  stacks: [],
  lingeringBuff: null,
  lingerTurnsLeft: 0,
});

export const mergeElementBuff = (a: ElementBuff | null, b: ElementBuff | null): ElementBuff => {
  if (!a && !b) return {};
  if (!a) return { ...b };
  if (!b) return { ...a };
  return {
    intPct: (a.intPct ?? 0) + (b.intPct ?? 0),
    defPct: (a.defPct ?? 0) + (b.defPct ?? 0),
    mdefPct: (a.mdefPct ?? 0) + (b.mdefPct ?? 0),
    spdFlat: (a.spdFlat ?? 0) + (b.spdFlat ?? 0),
    dmgReductionPct: (a.dmgReductionPct ?? 0) + (b.dmgReductionPct ?? 0),
    magicCritChance: (a.magicCritChance ?? 0) + (b.magicCritChance ?? 0),
    turnStartMagicMult: (a.turnStartMagicMult ?? 0) + (b.turnStartMagicMult ?? 0),
  };
};

export const computeStackBuff = (stacks: ElementKind[]): ElementBuff => {
  const counts: Record<ElementKind, number> = { fire: 0, ice: 0, lightning: 0 };
  for (const k of stacks) counts[k] = Math.min(ELEMENT_STACK_CAP, counts[k] + 1);
  let buff: ElementBuff = {};
  for (const k of ["fire", "ice", "lightning"] as ElementKind[]) {
    const n = counts[k];
    if (n > 0) buff = mergeElementBuff(buff, ELEMENT_BUFFS[k][n - 1]);
  }
  return buff;
};

export const tickElementLinger = (state: ElementState): void => {
  if (state.lingerTurnsLeft > 0) {
    state.lingerTurnsLeft -= 1;
    if (state.lingerTurnsLeft === 0) state.lingeringBuff = null;
  }
};

export const currentElementBuff = (state: ElementState): ElementBuff => {
  return mergeElementBuff(computeStackBuff(state.stacks), state.lingeringBuff);
};

export const pushElementStack = (state: ElementState, kind: ElementKind): void => {
  if (state.stacks.length >= ELEMENT_STACK_CAP) state.stacks.shift();
  state.stacks.push(kind);
};

export const consumeStacksForCombo = (state: ElementState): void => {
  state.lingeringBuff = computeStackBuff(state.stacks);
  state.lingerTurnsLeft = ELEMENT_LINGER_TURNS;
  state.stacks = [];
};

export type ComboKind =
  | "hellfire"
  | "absolute_zero"
  | "thunder_god"
  | "magma"
  | "plasma"
  | "frost_storm"
  | "harmony";

export const pickCombo = (stacks: ElementKind[]): ComboKind | null => {
  if (stacks.length === 0) return null;
  const kinds = new Set(stacks);
  if (kinds.size === 3) return "harmony";
  if (kinds.size === 2) {
    if (kinds.has("fire") && kinds.has("ice")) return "magma";
    if (kinds.has("fire") && kinds.has("lightning")) return "plasma";
    return "frost_storm";
  }
  return stacks[0] === "fire" ? "hellfire" : stacks[0] === "ice" ? "absolute_zero" : "thunder_god";
};

export const lookupComboEffect = (combo: ComboKind, stacks: ElementKind[]) => {
  switch (combo) {
    case "hellfire":
      return ELEMENT_COMBO_EFFECTS.hellfire(stacks.length);
    case "absolute_zero":
      return ELEMENT_COMBO_EFFECTS.absolute_zero(stacks.length);
    case "thunder_god":
      return ELEMENT_COMBO_EFFECTS.thunder_god(stacks.length);
    case "magma":
      return ELEMENT_COMBO_EFFECTS.magma();
    case "plasma":
      return ELEMENT_COMBO_EFFECTS.plasma();
    case "frost_storm":
      return ELEMENT_COMBO_EFFECTS.frost_storm();
    case "harmony":
      return ELEMENT_COMBO_EFFECTS.harmony();
  }
};

const COMBO_NAMES: Record<ComboKind, string> = {
  hellfire: "지옥불",
  absolute_zero: "절대영도",
  thunder_god: "뇌신강림",
  magma: "마그마 폭발",
  plasma: "플라즈마",
  frost_storm: "빙뢰 폭풍",
  harmony: "원소 조화",
};

export const comboName = (combo: ComboKind): string => COMBO_NAMES[combo];
