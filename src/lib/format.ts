import { MATERIALS } from "@/lib/game/data";
import type { EquipmentBonus, Materials, MaterialKind } from "@/lib/game/types";

export function formatSec(s: number): string {
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}분` : `${m}분 ${rem}초`;
}

export function formatGains(gained: { gold?: number; iron?: number }, exp: number): string {
  const parts: string[] = [];
  if (gained.gold) parts.push(`골드 +${gained.gold}`);
  if (gained.iron) parts.push(`철 +${gained.iron}`);
  if (exp) parts.push(`EXP +${exp}`);
  return parts.join(" · ") || "—";
}

const BONUS_LABELS: Record<keyof EquipmentBonus, string> = {
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  mdef: "MDEF",
  spd: "SPD",
  agi: "AGI",
  int: "INT",
  str: "STR",
  vit: "VIT",
  matk: "MATK",
  crit: "CRI",
  dotAmp: "DOT",
};

export function formatBonus(bonus: EquipmentBonus): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(bonus)) {
    if (!v) continue;
    const label = BONUS_LABELS[k as keyof EquipmentBonus];
    if (k === "crit" || k === "dotAmp") {
      parts.push(`${label} +${(Number(v) * 100).toFixed(1)}%`);
      continue;
    }
    parts.push(`${label} +${v}`);
  }
  return parts.join(", ");
}

export function formatMaterials(materials: Materials): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(materials)) {
    if (!v) continue;
    const def = MATERIALS[k as MaterialKind];
    if (!def) continue;
    parts.push(`${def.name} ×${v}`);
  }
  return parts.join(", ") || "—";
}

export function hasMaterials(materials: Materials): boolean {
  return Object.values(materials).some((v) => (v ?? 0) > 0);
}

export function formatTreasure(
  t: { gold?: number; iron?: number; materials?: Materials },
  hits: number = 1,
): string {
  const n = Math.max(1, hits);
  const parts: string[] = [];
  if (t.gold) parts.push(`골드 +${t.gold * n}`);
  if (t.iron) parts.push(`철 +${t.iron * n}`);
  if (t.materials) {
    const scaled: Materials = {};
    for (const [k, v] of Object.entries(t.materials)) {
      if (v) scaled[k as MaterialKind] = v * n;
    }
    const m = formatMaterials(scaled);
    if (m && m !== "—") parts.push(m);
  }
  return parts.join(", ");
}

export function formatRewardShort(reward: {
  gold?: number;
  iron?: number;
  materials?: Materials;
}): string {
  const parts: string[] = [];
  if (reward.gold) parts.push(`골드 ${reward.gold.toLocaleString()}`);
  if (reward.iron) parts.push(`철 ${reward.iron.toLocaleString()}`);
  if (reward.materials) {
    for (const [k, v] of Object.entries(reward.materials)) {
      if (!v) continue;
      const def = MATERIALS[k as MaterialKind];
      if (def) parts.push(`${def.name} ×${v}`);
    }
  }
  return parts.join(", ");
}
