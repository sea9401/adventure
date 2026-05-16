import { describe, it, expect } from "vitest";
import {
  resolveBattle,
  type EquippedAPSkill,
  type PlayerCombat,
} from "./engine";
import type { Monster } from "../data/monsters";
import {
  getAPSkillByName,
  type APSkill,
  type APSkillCondition,
} from "../character/apSkills";

// AP 조건 빌드 시뮬 — 동일 시드/적/스탯 으로 두 빌드를 N 회 돌려 발동 횟수·총 데미지 비교.
// 단위 테스트가 아닌 "콤보가 의도대로 작동하는가" 검증용. 통계적 invariant 만 assert.

const PLAYER_BASE: PlayerCombat = {
  hp: 300,
  maxHp: 300,
  atk: 20,
  def: 8,
  spd: 12,
  evasionPct: 0,
  attackCount: 1,
};

const SHADOW_CUT = getAPSkillByName("그림자 베기")!;
const HEAVEN_SLAY = getAPSkillByName("천살")!;
const MENDING = getAPSkillByName("회복술")!;

function eq(skill: APSkill, condition: APSkillCondition = { kind: "always" }): EquippedAPSkill {
  return { skill, condition };
}

function makeEnemy(hp: number, atk = 18, def = 6): Monster {
  return { name: "더미", tags: ["beast"], hp, atk, def, spd: 8, exp: 0 };
}

type Stats = {
  battles: number;
  wins: number;
  totalTurns: number;
  fires: Record<string, number>;
  meaningfulHeals: number; // mending 발동 + 실제 회복량 > 0
  wastedHeals: number;     // mending 발동했는데 HP 클램프로 회복량 0
};

function runBatch(
  N: number,
  build: ReadonlyArray<EquippedAPSkill>,
  enemyHp: number,
): Stats {
  const out: Stats = {
    battles: 0,
    wins: 0,
    totalTurns: 0,
    fires: {},
    meaningfulHeals: 0,
    wastedHeals: 0,
  };
  for (let i = 0; i < N; i++) {
    const player: PlayerCombat = {
      ...PLAYER_BASE,
      equippedAPSkills: build,
    };
    const r = resolveBattle(player, makeEnemy(enemyHp), "용사", {
      pickAction: () => ({ kind: "attack" }),
      potions: {},
    });
    out.battles++;
    if (r.outcome === "win") out.wins++;
    out.totalTurns += r.turns;
    for (const e of r.finalState.log) {
      if (e.kind === "info" && e.text.startsWith("[회복술]")) {
        const m = e.text.match(/HP \+(\d+)/);
        const healed = m ? Number(m[1]) : 0;
        if (healed > 0) out.meaningfulHeals++;
        else out.wastedHeals++;
        out.fires["회복술"] = (out.fires["회복술"] ?? 0) + 1;
      }
      if (e.kind === "player_attack") {
        const m = e.text.match(/^\[([^\]]+)\]/);
        if (m) {
          for (const lbl of m[1].split(/\s*\+\s*/)) {
            if (lbl === "그림자 베기" || lbl === "천살") {
              out.fires[lbl] = (out.fires[lbl] ?? 0) + 1;
            }
          }
        }
      }
    }
  }
  return out;
}

function fmt(s: Stats): string {
  const fires = Object.entries(s.fires)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return `wins ${s.wins}/${s.battles} | avg turns ${(s.totalTurns / s.battles).toFixed(1)} | fires {${fires}} | heals ${s.meaningfulHeals} 유효 / ${s.wastedHeals} 낭비`;
}

describe("AP 조건 빌드 시뮬 — 통계", () => {
  // 시뮬을 어떤 적 hp 로 돌릴지: 평균 ~15턴 정도가 콤보 차이 보이기 좋다.
  const ENEMY_HP = 600;
  const N = 100;

  it("방어 분리: mending(HP<50%) — 같은 슬롯 풀이 SC 로 흘러 클리어 속도 ↑", () => {
    // A1: slot1 mending(always) + slot2 SC. cost 같아서 slot1 만 발동 — SC 영원히 미발동.
    const a1 = runBatch(
      N,
      [eq(MENDING), eq(SHADOW_CUT)],
      ENEMY_HP,
    );
    // A2: slot1 mending(HP<50%) — 풀피일 때 미발동, 그 사이 slot2 SC 가 딜 누적.
    const a2 = runBatch(
      N,
      [eq(MENDING, { kind: "hp_below_pct", value: 50 }), eq(SHADOW_CUT)],
      ENEMY_HP,
    );

    console.log(`[방어 분리]`);
    console.log(`  A1 (mending always + SC)    : ${fmt(a1)}`);
    console.log(`  A2 (mending HP<50% + SC)    : ${fmt(a2)}`);

    // 두 빌드 모두 클리어 — 하지만 A2 가 SC 가 발동하면서 더 빠르게 잡는다.
    expect(a2.wins).toBeGreaterThanOrEqual(a1.wins - 5); // 둘 다 거의 100% 승률
    expect(a2.totalTurns).toBeLessThan(a1.totalTurns); // 더 빠른 클리어
    // A2 는 SC 가 실제로 발동 (A1 은 mending 만 발동).
    expect(a2.fires["그림자 베기"] ?? 0).toBeGreaterThan(a1.fires["그림자 베기"] ?? 0);
  });

  it("저축형 큰 한 방: slot1 HS(always) + slot2 SC(HP<50%) — SC 가 AP 안 빨고 HS 발동 가능", () => {
    // B1: 둘 다 always (slot1 HS, slot2 SC). SC(cost 3) 가 slot2 에서 매 AP=3 마다 발동
    //     → HS 가 AP=5 까지 못 모음. HS=0.
    const b1 = runBatch(
      N,
      [eq(HEAVEN_SLAY), eq(SHADOW_CUT)],
      ENEMY_HP,
    );
    // B2: slot1 HS always, slot2 SC(HP<50%). 풀피일 땐 slot2 미발동 → AP 가 5 까지 모인다 → HS 발동.
    //     wounded 일 땐 SC 가 filler 로 딜.
    const b2 = runBatch(
      N,
      [eq(HEAVEN_SLAY), eq(SHADOW_CUT, { kind: "hp_below_pct", value: 50 })],
      ENEMY_HP,
    );

    console.log(`[저축형 큰 한 방]`);
    console.log(`  B1 (둘 다 always)            : ${fmt(b1)}`);
    console.log(`  B2 (HS always + SC HP<50%)  : ${fmt(b2)}`);

    // 검증: B1 에선 HS 가 거의 안 나오지만 B2 에선 자주 나온다.
    const b1HS = b1.fires["천살"] ?? 0;
    const b2HS = b2.fires["천살"] ?? 0;
    expect(b2HS).toBeGreaterThan(b1HS);
    // 그리고 B2 가 클리어 (HS 큰 한 방 + 필요 시 SC filler).
    expect(b2.wins).toBeGreaterThan(b1.wins);
  });

  it("AP 저축: heaven_slay 가 단독 슬롯이면 always 만으로도 발동", () => {
    // C1: HS 단독 + SC 단독. SC 가 AP 를 빠는 비교군.
    const c1 = runBatch(N, [eq(SHADOW_CUT)], ENEMY_HP);
    const c2 = runBatch(N, [eq(HEAVEN_SLAY)], ENEMY_HP);

    console.log(`[AP 저축 베이스라인]`);
    console.log(`  C1 (SC 단독)                : ${fmt(c1)}`);
    console.log(`  C2 (HS 단독)                : ${fmt(c2)}`);

    // SC 가 HS 보다 자주 발동 — cost 차이 (3 vs 5).
    expect(c1.fires["그림자 베기"] ?? 0).toBeGreaterThan(c2.fires["천살"] ?? 0);
  });
});
