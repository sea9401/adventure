import type { MaterialKind } from "./primitives";
import type { EquipmentId } from "./equipment";

export type Enemy = {
  name: string;
  hp: number;
  atk: number;
  def: number;
  mdef: number;
  spd: number;
  agi: number;
  int: number;
  drop?: { id: MaterialKind; chance: number };
};

export type BossSkillEffect =
  | { kind: "self_heal"; pct: number }
  | { kind: "next_attack_mult"; mult: number }
  | { kind: "atk_boost"; pct: number; turns: number }
  | { kind: "def_boost"; pct: number; turns: number }
  | { kind: "dot_pct"; pct: number; turns: number }
  | { kind: "spd_debuff"; amount: number; turns: number }
  | { kind: "flat_damage"; atkMult: number };

export type BossSkillDef = {
  name: string;
  cooldown: number;
  effect: BossSkillEffect;
};

export type Boss = {
  name: string;
  hp: number;
  atk: number;
  def: number;
  mdef: number;
  spd: number;
  agi: number;
  int: number;
  drop: MaterialKind;
  scrollDrop: { id: MaterialKind; chance: number; guaranteedCount?: number };
  // 보스 고유 유니크 장비 드랍 — 처치 시 chance 확률로 inventory 추가
  uniqueDrop?: { id: EquipmentId; chance: number };
  skill?: BossSkillDef;
  flavor?: string;
};
