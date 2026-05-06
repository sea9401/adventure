import type { Character, Estate, Resources } from "./types";
import {
  FARM_GOLD_PER_SEC,
  HP_REGEN_PER_SEC,
  MINE_IRON_PER_SEC,
  TRAINING_EXP_PER_SEC,
} from "./data";
import { computeStats } from "./stats";
import { applyExp } from "./progression";

// 시간 조작 방어 — 한 tick에 최대 8시간만 인정 (현실적 오프라인 cap)
const MAX_OFFLINE_SEC = 8 * 60 * 60;

export const applyEstateTick = (estate: Estate, resources: Resources, character: Character) => {
  const now = Date.now();
  const rawElapsed = Math.max(0, (now - estate.lastTickAt) / 1000);
  const elapsedSec = Math.min(MAX_OFFLINE_SEC, rawElapsed);
  const goldGain = FARM_GOLD_PER_SEC(estate.farm) * elapsedSec;
  const ironGain = MINE_IRON_PER_SEC(estate.mine) * elapsedSec;
  const expGain = TRAINING_EXP_PER_SEC(estate.training ?? 0) * elapsedSec;
  const nextCharacter = expGain > 0 ? applyExp(character, expGain) : character;
  return {
    estate: { ...estate, lastTickAt: now },
    resources: {
      gold: resources.gold + goldGain,
      iron: resources.iron + ironGain,
    },
    character: nextCharacter,
  };
};

export const applyHpRegen = (character: Character, estate: Estate, hpUpdatedAt: number) => {
  const now = Date.now();
  const rawElapsed = Math.max(0, (now - hpUpdatedAt) / 1000);
  const elapsedSec = Math.min(MAX_OFFLINE_SEC, rawElapsed);
  const stats = computeStats(character);
  const regen = HP_REGEN_PER_SEC(estate.inn) * elapsedSec;
  const newHp = Math.min(stats.maxHp, character.currentHp + regen);
  return {
    character: { ...character, currentHp: newHp },
    hpUpdatedAt: now,
  };
};
