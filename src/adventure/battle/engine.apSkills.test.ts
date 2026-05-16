import { describe, it, expect } from "vitest";
import {
  advanceTurn,
  initialBattleState,
  resolveBattle,
  type PlayerCombat,
} from "./engine";
import type { Monster } from "../data/monsters";
import { AP_CAP, getAPSkillByName } from "../character/apSkills";

const PLAYER: PlayerCombat = {
  hp: 9999,
  maxHp: 9999,
  atk: 10,
  def: 5,
  spd: 10,
  evasionPct: 0,
  attackCount: 1,
};

function enemy(hp = 100, overrides: Partial<Monster> = {}): Monster {
  return {
    name: "적",
    tags: ["beast"],
    hp,
    atk: 8,
    def: 3,
    spd: 5,
    exp: 5,
    ...overrides,
  };
}

// 그림자 베기 — ATK × 1.5, DEF 무시. AP cost 3.
const SHADOW_CUT = getAPSkillByName("그림자 베기")!;

// damageBetween(10, 3) = 7. AP fired: damageBetween(15, 0) = 15.

describe("AP 스킬 시스템 — 그림자 베기", () => {
  it("AP 미장착이면 ap=0 고정, 발동 X, 평소 데미지", () => {
    let s = initialBattleState(PLAYER, enemy(100), "용사");
    expect(s.ap).toBe(0);
    s = advanceTurn(s, PLAYER, "용사");
    expect(s.enemyHp).toBe(93); // 평타 7
  });

  it("AP 장착 시 시작 AP=2, 첫 턴은 미달 — 평타", () => {
    const p: PlayerCombat = { ...PLAYER, equippedAPSkills: [SHADOW_CUT] };
    let s = initialBattleState(p, enemy(100), "용사");
    expect(s.ap).toBe(2);
    s = advanceTurn(s, p, "용사");
    // 발동 시점에 state.ap = 2 < 3 → 미발동. 평타 7. 회복 +1 → 3.
    expect(s.enemyHp).toBe(93);
    expect(s.ap).toBe(3);
  });

  it("AP 3 충족 턴 — ATK ×1.5 + DEF 무시 (damage 15)", () => {
    const p: PlayerCombat = { ...PLAYER, equippedAPSkills: [SHADOW_CUT] };
    let s = initialBattleState(p, enemy(1000), "용사");
    s = advanceTurn(s, p, "용사"); // turn 1: 평타 7, AP 2→3
    expect(s.enemyHp).toBe(993);
    expect(s.ap).toBe(3);
    s = advanceTurn(s, p, "용사"); // 적 턴
    s = advanceTurn(s, p, "용사"); // turn 2: 발동, ATK 15 DEF 0 → 15 데미지, AP 3+1-3=1
    expect(s.enemyHp).toBe(1000 - 7 - 15);
    expect(s.ap).toBe(1);
  });

  it("AP cap 5 에서 멈춤 — overflow 손실", () => {
    // 발동 불가하게 코스트 막아두고 AP 만 누적시켜 cap 검증.
    const p: PlayerCombat = {
      ...PLAYER,
      equippedAPSkills: [{ ...SHADOW_CUT, apCost: 99 }],
    };
    let s = initialBattleState(p, enemy(9999), "용사");
    // 2 → 3 → ... cap 도달 후 더 회복 안 됨.
    for (let i = 0; i < 10; i++) {
      s = advanceTurn(s, p, "용사");
      if (s.phase === "enemy") s = advanceTurn(s, p, "용사");
    }
    expect(s.ap).toBe(AP_CAP);
  });

  it("AP 스킬은 첫 공격에만 발동 — 같은 턴 추가타엔 평타", () => {
    const p: PlayerCombat = {
      ...PLAYER,
      attackCount: 2,
      equippedAPSkills: [SHADOW_CUT],
    };
    let s = initialBattleState(p, enemy(1000), "용사");
    // turn 1: 1st 평타 7 (AP 2 미달), 2nd 평타 7. AP 회복 ×2 = 4.
    s = advanceTurn(s, p, "용사"); // 1st
    expect(s.enemyHp).toBe(993);
    s = advanceTurn(s, p, "용사"); // 2nd, attacksLeft 0 → 턴 종료
    expect(s.enemyHp).toBe(986);
    expect(s.ap).toBe(4);
    // 적 턴 (자동 이미 종료) — 다음 advanceTurn 은 turn 2 의 1st.
    s = advanceTurn(s, p, "용사"); // 적 턴
    // turn 2: 1st AP 4≥3 → 발동 (15 데미지), 2nd 는 평타 7.
    s = advanceTurn(s, p, "용사"); // 1st of turn 2 — fires AP
    expect(s.enemyHp).toBe(986 - 15);
    s = advanceTurn(s, p, "용사"); // 2nd of turn 2 — 평타
    expect(s.enemyHp).toBe(986 - 15 - 7);
  });

  describe("턴 마커에 AP 표기 (장착 여부 무관 — 시스템 발견용)", () => {
    it("미장착도 '${N}턴 · AP 0' 표기", () => {
      const r = resolveBattle(PLAYER, enemy(50), "용사", {
        pickAction: () => ({ kind: "attack" }),
        potions: {},
      });
      const markers = r.finalState.log.filter((e) => e.kind === "turn_marker");
      expect(markers.length).toBeGreaterThan(0);
      expect(markers[0].text).toBe("1턴 · AP 0");
      for (const m of markers) {
        expect(m.text).toMatch(/^\d+턴 · AP \d+$/);
      }
    });

    it("AP 장착 시 첫 턴 마커가 시작값 2", () => {
      const p: PlayerCombat = { ...PLAYER, equippedAPSkills: [SHADOW_CUT] };
      const r = resolveBattle(p, enemy(50), "용사", {
        pickAction: () => ({ kind: "attack" }),
        potions: {},
      });
      const markers = r.finalState.log.filter((e) => e.kind === "turn_marker");
      expect(markers.length).toBeGreaterThan(0);
      expect(markers[0].text).toBe("1턴 · AP 2");
    });
  });

  it("새 전투 시작 시 AP 가 시작값 2 로 리셋", () => {
    const p: PlayerCombat = { ...PLAYER, equippedAPSkills: [SHADOW_CUT] };
    let s = initialBattleState(p, enemy(9999), "용사");
    s = advanceTurn(s, p, "용사");
    s = advanceTurn(s, p, "용사");
    s = advanceTurn(s, p, "용사"); // AP 발동 후 1
    expect(s.ap).toBeLessThan(2);
    // 새 전투.
    const s2 = initialBattleState(p, enemy(9999), "용사");
    expect(s2.ap).toBe(2);
    expect(s2.turn.apSkillFiredThisTurn).toBeNull();
  });
});

// ── PR-1 신규 효과 ──
const MENDING = getAPSkillByName("회복술")!;
const DEEP_WOUND = getAPSkillByName("깊은 상처")!;
const EXTRA_EVADE = getAPSkillByName("추가 회피")!;
const HEAVEN_SLAY = getAPSkillByName("천살")!;

describe("AP 스킬 — 회복술 (heal_pct)", () => {
  it("발동 시 maxHP × 25% 즉시 회복, 평타 데미지는 그대로", () => {
    const wounded: PlayerCombat = {
      ...PLAYER,
      hp: 1000,
      maxHp: 4000,
      equippedAPSkills: [MENDING],
    };
    let s = initialBattleState(wounded, enemy(9999), "용사");
    expect(s.playerHp).toBe(1000);
    s = advanceTurn(s, wounded, "용사"); // turn 1: AP 2 < 3 → 미발동, 평타.
    expect(s.playerHp).toBe(1000); // 미발동 — 회복 X
    s = advanceTurn(s, wounded, "용사"); // 적 턴.
    s = advanceTurn(s, wounded, "용사"); // turn 2: AP 3 → 발동, +1000 회복.
    // 적 공격으로 일부 깎인 상태에서 +1000. 회복분이 적용된 게 보이면 OK.
    expect(s.playerHp).toBeGreaterThanOrEqual(1000);
  });

  it("maxHP 클램프 — 풀피에서 발동해도 maxHP 초과 X", () => {
    const full: PlayerCombat = {
      ...PLAYER,
      hp: 100,
      maxHp: 100,
      equippedAPSkills: [MENDING],
    };
    let s = initialBattleState(full, enemy(9999), "용사");
    s = advanceTurn(s, full, "용사");
    s = advanceTurn(s, full, "용사");
    s = advanceTurn(s, full, "용사"); // 발동 턴 — 데미지 받지 않았다면 풀피 유지.
    expect(s.playerHp).toBeLessThanOrEqual(100);
  });
});

describe("AP 스킬 — 깊은 상처 (apply_bleed)", () => {
  it("발동 시 적에게 출혈 5스택 즉시 부여 (기존 스택과 누적)", () => {
    const p: PlayerCombat = { ...PLAYER, equippedAPSkills: [DEEP_WOUND] };
    let s = initialBattleState(p, enemy(9999), "용사");
    expect(s.stacks.bleedStacks).toBe(0);
    s = advanceTurn(s, p, "용사"); // AP 2 < 3 → 미발동.
    expect(s.stacks.bleedStacks).toBe(0);
    s = advanceTurn(s, p, "용사"); // 적 턴.
    s = advanceTurn(s, p, "용사"); // AP 3 → 발동.
    expect(s.stacks.bleedStacks).toBe(5);
  });
});

describe("AP 스킬 — 추가 회피 (add_guaranteed_evades)", () => {
  it("발동 시 보장 회피 잔량 +1", () => {
    const p: PlayerCombat = {
      ...PLAYER,
      equippedAPSkills: [EXTRA_EVADE],
      guaranteedEvades: 0,
    };
    let s = initialBattleState(p, enemy(9999), "용사");
    expect(s.stacks.evadesRemaining).toBe(0);
    // AP 1 cost — 첫 턴부터 발동 가능 (시작 AP 2).
    s = advanceTurn(s, p, "용사");
    expect(s.stacks.evadesRemaining).toBe(1);
  });
});

describe("AP 스킬 — 천살 (ignoresEvasion + ignoresDef)", () => {
  it("회피 100% 적 상대로도 큰 한 방 — ATK ×3 + DEF 무시", () => {
    const p: PlayerCombat = {
      ...PLAYER,
      atk: 10,
      equippedAPSkills: [HEAVEN_SLAY],
    };
    // 회피 100% 적 — 천살이 발동하기 전까진 데미지 0, 발동 시 30 데미지.
    let s = initialBattleState(
      p,
      { ...enemy(9999), evasionPct: 100, def: 50 },
      "용사",
    );
    const startHp = s.enemyHp;
    let biggestHit = 0;
    let prevEnemyHp = startHp;
    // 20턴 충분 — turn 4 즈음에 천살 발동.
    for (let i = 0; i < 40; i++) {
      s = advanceTurn(s, p, "용사");
      const delta = prevEnemyHp - s.enemyHp;
      if (delta > biggestHit) biggestHit = delta;
      prevEnemyHp = s.enemyHp;
    }
    // ATK 10 × 3.0 = 30, DEF 무시. damageBetween variance → 25 이상.
    expect(biggestHit).toBeGreaterThanOrEqual(25);
  });
});
