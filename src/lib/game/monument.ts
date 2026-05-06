import { MONUMENT_KILL_CAP, MONUMENT_LEVEL_FACTOR, MONUMENT_TROPHIES } from "./data";

export type MonumentExtra = Partial<
  Record<"hp" | "atk" | "def" | "mdef" | "spd" | "agi" | "int" | "str" | "vit" | "matk", number>
>;

export const getMonumentBonus = (
  monumentLv: number | undefined,
  bossKillCounts: Partial<Record<string, number>> | undefined,
): MonumentExtra => {
  const out: MonumentExtra = {};
  const factor = MONUMENT_LEVEL_FACTOR(monumentLv ?? 0);
  if (factor <= 0 || !bossKillCounts) return out;
  for (const trophy of MONUMENT_TROPHIES) {
    const kills = Math.min(MONUMENT_KILL_CAP, bossKillCounts[trophy.bossName] ?? 0);
    if (kills <= 0) continue;
    for (const [k, v] of Object.entries(trophy.perKill)) {
      const key = k as keyof MonumentExtra;
      out[key] = (out[key] ?? 0) + (v ?? 0) * kills * factor;
    }
  }
  return out;
};
