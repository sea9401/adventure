// 실제 F89 플레이어 빌드를 그대로 재구성해 고탑 어디서 막히는지 검증.
// sim 충실성 판별: F90 부근에서 막히면 sim 신뢰 가능. 실행: node --import tsx scripts/validate-real-build.ts
import { resolveBattle, type PlayerCombat } from "../src/adventure/battle/engine";
import { pickAutoAction } from "../src/adventure/battle/pickAutoAction";
import { derivePlayerCombat } from "../src/adventure/character/derivePlayerCombat";
import { MONSTERS, type Monster } from "../src/adventure/data/monsters";
import {
  BOSS_SLOTS,
  bossBaseMonster,
  bossDisplayName,
  bossSlotForFloor,
  mobPoolForFloor,
  pickMobFromPool,
} from "../src/adventure/tower/floorPools";
import {
  isBossFloor,
  scaledStats,
  towerEnemyAccuracy,
} from "../src/adventure/tower/scaling";

const TRIALS = Number(process.env.TRIALS ?? 120);

// ── 실제 F89 빌드 (DB 덤프 그대로) ─────────────────────────────────
const weapon = {
  name: "행운의 별빛 단검", slot: "weapon", tier: 6,
  bonus: { atk: 38, luk: 30 },
  enchantSlots: [{ value: 11, affixId: "dodge" }, { value: 6, affixId: "dodge" }],
} as never;
const armor = {
  name: "행운의 별빛 갑옷", slot: "armor", tier: 6,
  bonus: { def: 31, luk: 21 },
  enchantSlots: [{ value: 13, affixId: "breaker" }, { value: 9, affixId: "dodge" }],
} as never;
const accessory = {
  name: "창공의 옥새", slot: "accessory", tier: 5,
  bonus: { atk: 10, def: 10, dex: 5, luk: 5, spd: 5, str: 5, vit: 5 },
} as never;

const flags = new Set<string>([
  "peak_giant_defeated", "volcano_heart_defeated", "starspire_keeper_defeated",
  "skyfolk_king_defeated", "endgame_apex_defeated",
]);

const derived = derivePlayerCombat({
  level: 100,
  baseStats: { str: 3, dex: 3, vit: 3, spd: 3, luk: 3 },
  allocatedStats: { str: 0, dex: 17, vit: 17, spd: 17, luk: 68 },
  equipped: { weapon, armor, accessory },
  equippedSkills: ["이중 행운", "만물 행운", "행운의 별", "그림자 베기", "만개"],
  equippedFeats: ["흡혈", "행운의 방패"],
  equippedRunes: [
    { id: "rune_training", grade: 3 },
    { id: "rune_training", grade: 3 },
    { id: "rune_fortune", grade: 3 },
  ],
  learnedAPSkills: [
    "그림자 베기", "회복술", "폭주", "집중의 호흡", "천살", "폭풍 일격", "깊은 상처",
    "광기", "결의", "광살참", "약점 노출", "잔상", "연환격", "천뢰 일격", "빛의 활공",
    "정화", "별빛 끊기", "별빛 매듭", "별빛 한기", "별빛 회수", "별빛 흩기", "잔영 베기",
  ],
  paragonAllocations: { fortune: 14 },
  storyFlagIds: flags,
  hp: 99999,
}).player;

const p = derived;
console.log("=== 재구성된 실제 F89 빌드 ===");
console.log(
  `atk ${p.atk} def ${p.def} hp ${p.maxHp} eva ${p.evasionPct}% ` +
  `crit ${(p.critChancePct ?? 0).toFixed(0)}% extra ${(p.extraAttackChancePct ?? 0).toFixed(0)}% ` +
  `attackCount ${p.attackCount} AP스킬 ${p.equippedAPSkills?.length ?? 0}개`,
);

function buildFloorEnemy(floor: number): Monster {
  const slot = bossSlotForFloor(floor);
  if (slot) {
    const base = bossBaseMonster(slot);
    const s = scaledStats(base, floor, slot.bossMultiplier);
    return { ...base, name: bossDisplayName(slot), hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, accuracy: towerEnemyAccuracy(floor, true) };
  }
  const pool = mobPoolForFloor(floor);
  const baseName = pool.length === 0 ? bossBaseMonster(BOSS_SLOTS[0]).name : pickMobFromPool(pool);
  const base = MONSTERS[baseName] ?? bossBaseMonster(BOSS_SLOTS[0]);
  const s = scaledStats(base, floor, 1);
  return { ...base, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, accuracy: towerEnemyAccuracy(floor, false) };
}

function winRate(floor: number): number {
  let w = 0;
  for (let i = 0; i < TRIALS; i++) {
    const enemy = buildFloorEnemy(floor);
    const r = resolveBattle({ ...p, hp: p.maxHp }, enemy, "용사", {
      pickAction: (s) => pickAutoAction(s, { rules: [], potions: {} }),
      potions: {},
      isBoss: isBossFloor(floor),
    });
    if (r.outcome === "win") w++;
  }
  return Math.round((w / TRIALS) * 100);
}

console.log("\n층   WR%   (★=보스)");
for (let f = 10; f <= 130; f += 10) {
  // 보스층 + 그 직전 잡몹층 둘 다
  for (const ff of [f - 1, f]) {
    if (ff < 1) continue;
    const wr = winRate(ff);
    const boss = isBossFloor(ff) ? " ★보스" : "";
    console.log(`${String(ff).padStart(3)}  ${String(wr).padStart(3)}%${boss}`);
  }
}
