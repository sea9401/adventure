import type { Character, GameState, GameStats } from "./types";
import { computeStats } from "./stats";

export const initialState = (): GameState => {
  const character: Character = {
    name: "모험가",
    level: 1,
    exp: 0,
    skillExp: 0,
    currentClass: "none",
    learnedAdvancedSkills: [],
    currentHp: 0,
    statPoints: 0,
    allocatedStats: { str: 0, vit: 0, agi: 0, int: 0 },
  };
  const stats = computeStats(character);
  character.currentHp = stats.maxHp;
  return {
    character,
    resources: { gold: 0, iron: 0 },
    materials: {},
    crafted: {},
    equipmentInventory: {},
    estate: { farm: 0, mine: 0, inn: 0, training: 0, townHall: 1, lastTickAt: Date.now() },
    guild: { reputation: 0 },
    dispatch: null,
    log: [],
    hpUpdatedAt: Date.now(),
    bossCooldowns: {},
    lastSeenAt: Date.now(),
    stats: emptyStats(),
    achievements: [],
    claimedTiers: {},
    tutorialDismissed: false,
    combatLogEnabled: true,
    theme: "dark",
    lastBattles: [],
    currentTownId: "plains",
    unlockedTownIds: ["plains"],
  };
};

export const emptyStats = (): GameStats => ({
  totalKills: 0,
  totalBossKills: 0,
  totalCoopBossDefeats: 0,
  totalGoldEarned: 0,
  totalIronEarned: 0,
  totalDispatches: 0,
  totalAlchemyCrafted: 0,
  totalEquipmentCrafted: 0,
  classesUsed: ["none"],
  bossDefeatedNames: [],
  bossKillCounts: {},
  highestLevel: 1,
  totalDeaths: 0,
  totalDodges: 0,
  totalDamageTaken: 0,
  maxSingleHit: 0,
});
