// PvP 엔진의 AP 스킬 시스템 미러 — engine.apSkills.test.ts 의 PvE 시나리오를 양면에서 검증.
// PR-1c. PvP 는 양쪽이 PlayerCombat 이라 "공격자/방어자" 가 매 페이즈 토글된다 — AP 자원·
// turn 게이트(apSkillFiredThisTurn)·전투 시작 ap 가 양 사이드에 독립적으로 유지되어야 한다.

import { describe, it, expect } from "vitest";
import {
  advanceTurnPvP,
  initialBattleStatePvP,
  type PvPBattleState,
} from "./engine-pvp";
import type { PlayerCombat } from "./engine";
import { getAPSkillByName } from "../character/apSkills";

const BASE: PlayerCombat = {
  hp: 9999,
  maxHp: 9999,
  atk: 10,
  def: 5,
  spd: 10,
  evasionPct: 0,
  attackCount: 1,
};

const SHADOW_CUT = getAPSkillByName("그림자 베기")!;
const MENDING = getAPSkillByName("회복술")!;
const DEEP_WOUND = getAPSkillByName("깊은 상처")!;
const EXTRA_EVADE = getAPSkillByName("추가 회피")!;
const HEAVEN_SLAY = getAPSkillByName("천살")!;

// 양 사이드 selectAPSkill 검증을 단순화 — 페이즈가 self 일 때 attack 단발.
function attack(s: PvPBattleState): PvPBattleState {
  return advanceTurnPvP(s, { kind: "attack" });
}

describe("PvP AP — 초기화", () => {
  it("양쪽 미장착 → 양쪽 ap 0", () => {
    const s = initialBattleStatePvP(BASE, BASE, "p1", "p2");
    expect(s.p1.ap).toBe(0);
    expect(s.p2.ap).toBe(0);
    expect(s.p1.turn.apSkillFiredThisTurn).toBeNull();
    expect(s.p2.turn.apSkillFiredThisTurn).toBeNull();
  });

  it("p1 만 장착 → p1.ap = 시작 AP(2), p2.ap = 0", () => {
    const p1: PlayerCombat = { ...BASE, equippedAPSkills: [SHADOW_CUT] };
    const s = initialBattleStatePvP(p1, BASE, "p1", "p2");
    expect(s.p1.ap).toBe(2);
    expect(s.p2.ap).toBe(0);
  });
});

describe("PvP AP — 그림자 베기 (atk_multiplier + ignoresDef)", () => {
  // damageBetween(10, 5) = 5. AP 발동 시 damageBetween(15, 0) = 15. variance 고려해 비교.
  it("p1 발동 턴 — 평타보다 큰 한 방", () => {
    const p1: PlayerCombat = { ...BASE, equippedAPSkills: [SHADOW_CUT] };
    let s = initialBattleStatePvP(p1, BASE, "p1", "p2");
    // turn 1 (p1): AP 2 < 3 → 평타.
    s = attack(s);
    const dmgTurn1 = BASE.hp - s.p2.hp;
    // turn 1 (p2): 적 평타.
    s = attack(s);
    // turn 2 (p1): AP 3 → 발동.
    const beforeTurn2 = s.p2.hp;
    s = attack(s);
    const dmgTurn2 = beforeTurn2 - s.p2.hp;
    expect(dmgTurn2).toBeGreaterThan(dmgTurn1);
    // AP 발동 후 차감: max(0, min(5, 3+1) - 3) = 1. 시작 2 + 1턴 회복 +1 = 3, 다음 턴 +1 = 4, - cost 3 → 1.
    expect(s.p1.ap).toBe(1);
  });

  it("p2 도 동등하게 발동 — 양면 대칭", () => {
    const p2: PlayerCombat = { ...BASE, equippedAPSkills: [SHADOW_CUT] };
    // p1 선공이 안 되도록 p1 의 SPD 를 낮춰 p2 선공.
    const p1: PlayerCombat = { ...BASE, spd: 5 };
    let s = initialBattleStatePvP(p1, p2, "p1", "p2");
    expect(s.phase).toBe("p2"); // p2 선공
    // turn 1 (p2): AP 2 < 3 → 평타. dmg 기록.
    const beforeP2Turn1 = s.p1.hp;
    s = attack(s);
    const dmgP2Turn1 = beforeP2Turn1 - s.p1.hp;
    // turn 1 (p1): 평타.
    s = attack(s);
    // turn 2 (p2): AP 3 → 발동, 평타보다 큰 한 방.
    const beforeP2Turn2 = s.p1.hp;
    s = attack(s);
    expect(beforeP2Turn2 - s.p1.hp).toBeGreaterThan(dmgP2Turn1);
    expect(s.p2.ap).toBe(1);
  });
});

describe("PvP AP — 회복술 (heal_pct)", () => {
  it("p1 발동 시 자가 회복, 적은 회복 안 함", () => {
    const wounded: PlayerCombat = {
      ...BASE,
      hp: 1000,
      maxHp: 4000,
      equippedAPSkills: [MENDING],
    };
    let s = initialBattleStatePvP(wounded, BASE, "p1", "p2");
    expect(s.p1.hp).toBe(1000);
    // turn 1 (p1): AP 2 < 3 → 미발동.
    s = attack(s);
    expect(s.p1.hp).toBe(1000);
    // turn 1 (p2): 적 평타 — p1 HP 감소.
    s = attack(s);
    const hpAfterEnemy = s.p1.hp;
    // turn 2 (p1): AP 3 → 발동, maxHp 25% = +1000 회복.
    s = attack(s);
    expect(s.p1.hp).toBeGreaterThan(hpAfterEnemy);
    expect(s.p1.hp - hpAfterEnemy).toBeGreaterThanOrEqual(1000);
  });
});

describe("PvP AP — 깊은 상처 (apply_bleed)", () => {
  it("발동 시 attacker.stacks.bleedStacksOnOpponent +5", () => {
    const p1: PlayerCombat = { ...BASE, equippedAPSkills: [DEEP_WOUND] };
    let s = initialBattleStatePvP(p1, BASE, "p1", "p2");
    expect(s.p1.stacks.bleedStacksOnOpponent).toBe(0);
    s = attack(s); // turn 1 p1: AP 2 < 3
    s = attack(s); // p2
    expect(s.p1.stacks.bleedStacksOnOpponent).toBe(0);
    s = attack(s); // turn 2 p1: 발동
    expect(s.p1.stacks.bleedStacksOnOpponent).toBe(5);
  });
});

describe("PvP AP — 추가 회피 (add_guaranteed_evades)", () => {
  it("발동 시 attacker 의 evadesRemaining +1 (1 AP — 첫 턴 발동)", () => {
    const p1: PlayerCombat = {
      ...BASE,
      equippedAPSkills: [EXTRA_EVADE],
      guaranteedEvades: 0,
    };
    let s = initialBattleStatePvP(p1, BASE, "p1", "p2");
    expect(s.p1.stacks.evadesRemaining).toBe(0);
    // 첫 턴: AP 1 cost — 즉시 발동.
    s = attack(s);
    expect(s.p1.stacks.evadesRemaining).toBe(1);
  });
});

describe("PvP AP — 천살 (ignoresEvasion + ignoresDef)", () => {
  it("회피 100% 적 상대로도 큰 한 방 발동 — dodge cascade 우회", () => {
    const p1: PlayerCombat = { ...BASE, atk: 10, equippedAPSkills: [HEAVEN_SLAY] };
    const wall: PlayerCombat = { ...BASE, evasionPct: 100, def: 50 };
    let s = initialBattleStatePvP(p1, wall, "p1", "p2");
    const startHp = s.p2.hp;
    let biggestHit = 0;
    let prev = startHp;
    // p1 페이즈만 검사: 매 라운드 attack 2회 (p1, p2). p1 의 ATK ×3=30, DEF 무시.
    for (let i = 0; i < 30; i++) {
      const before = s.p2.hp;
      s = attack(s);
      const delta = before - s.p2.hp;
      if (delta > biggestHit) biggestHit = delta;
      prev = s.p2.hp;
      if (s.phase === "ended") break;
    }
    expect(biggestHit).toBeGreaterThanOrEqual(25);
  });
});

describe("PvP AP — 턴당 1회 정책 + AP 회복", () => {
  it("같은 턴 추가타엔 AP 스킬 재발동 안 함", () => {
    const p1: PlayerCombat = {
      ...BASE,
      equippedAPSkills: [SHADOW_CUT],
      attackCount: 2, // 한 턴 2회 공격
    };
    let s = initialBattleStatePvP(p1, BASE, "p1", "p2");
    // 첫 턴 (p1): AP 2 — 평타 ×2. 매 공격 +1 AP → 2 → 3 → 4.
    s = attack(s); // 첫 공격 (firstAttackPending)
    s = attack(s); // 둘째 공격 (같은 페이즈, firstAttackPending=false)
    // p1 페이즈 종료 후 attacksLeft 0 → endAttackerPhase → 페이즈 p2 로.
    expect(s.phase).toBe("p2");
    expect(s.p1.turn.apSkillFiredThisTurn).toBeNull(); // 발동 안 함
    expect(s.p1.ap).toBe(4); // 2 → 3 → 4
  });

  it("회피 당해도 attacker AP +1 (행동 시도이므로)", () => {
    const p1: PlayerCombat = { ...BASE, equippedAPSkills: [SHADOW_CUT] };
    // p2 가 회피 강화 1 보유 — p1 첫 공격이 자동 회피됨.
    const dodger: PlayerCombat = { ...BASE, guaranteedEvades: 1 };
    let s = initialBattleStatePvP(p1, dodger, "p1", "p2");
    expect(s.p1.ap).toBe(2);
    s = attack(s); // p1 의 1회 공격이 보장 회피로 빗남 → endAttackerPhase.
    expect(s.p1.ap).toBe(3); // +1 (cost 차감 X — 발동 안 됨)
    expect(s.p1.turn.apSkillFiredThisTurn).toBeNull();
  });
});
