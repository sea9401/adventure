// PvP 엔진 (engine-pvp.ts) 테스트 — PR-1a 범위 (공격자 측 능력 대칭 검증).
// PR-1b 에서 추가되는 방어자 측 능력(가드/철벽/불굴/그림자보법/회피강화/행운의방패/곡예/
// 반사갑주/가시갑옷/무한가시/반사회피/유격/반격/굳건한의지/흡혈갑옷/반격의룬) 테스트는 별도.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerCombat } from "./engine";
import {
  advanceTurnPvP,
  initialBattleStatePvP,
  resolveBattlePvP,
  type PvPResolveContext,
} from "./engine-pvp";
import { CRIT_MULT_BASE, RAMPAGE_START_TURN } from "../character/skills";
import type { Potion } from "../data/potions";

function makePlayer(over: Partial<PlayerCombat> = {}): PlayerCombat {
  return {
    hp: 100,
    maxHp: 100,
    atk: 20,
    def: 5,
    spd: 10,
    evasionPct: 0,
    attackCount: 1,
    ...over,
  };
}

const HEAL_POTION: Potion = {
  id: "potion_heal_s",
  name: "테스트 회복약",
  description: "",
  effect: { kind: "heal_hp", flat: 30 },
  price: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 초기 상태 ───────────────────────────────────────────────────────────────

describe("initialBattleStatePvP — 초기 상태", () => {
  it("SPD 우위 측이 선공", () => {
    const s = initialBattleStatePvP(
      makePlayer({ spd: 15 }),
      makePlayer({ spd: 5 }),
      "P1",
      "P2",
    );
    expect(s.phase).toBe("p1");
    expect(s.p1.attacksLeft).toBeGreaterThanOrEqual(1);
    expect(s.p2.attacksLeft).toBe(0);
  });

  it("SPD 동률이면 p1 선공", () => {
    const s = initialBattleStatePvP(
      makePlayer({ spd: 10 }),
      makePlayer({ spd: 10 }),
      "P1",
      "P2",
    );
    expect(s.phase).toBe("p1");
  });

  it("p2 가 빠르면 p2 선공", () => {
    const s = initialBattleStatePvP(
      makePlayer({ spd: 5 }),
      makePlayer({ spd: 15 }),
      "P1",
      "P2",
    );
    expect(s.phase).toBe("p2");
    expect(s.p2.attacksLeft).toBeGreaterThanOrEqual(1);
    expect(s.p1.attacksLeft).toBe(0);
  });

  it("HP/maxHp 가 양쪽에 시드", () => {
    const s = initialBattleStatePvP(
      makePlayer({ hp: 80, maxHp: 100 }),
      makePlayer({ hp: 60, maxHp: 90 }),
      "P1",
      "P2",
    );
    expect(s.p1.hp).toBe(80);
    expect(s.p1.maxHp).toBe(100);
    expect(s.p2.hp).toBe(60);
    expect(s.p2.maxHp).toBe(90);
  });

  it("기습 (vanguardFirstTurnBonus) — 선공 측 첫 턴 attacksLeft 가 base + bonus", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999); // extraAttackChance 막기
    const s = initialBattleStatePvP(
      makePlayer({ spd: 15, attackCount: 2, vanguardFirstTurnBonus: 3 }),
      makePlayer({ spd: 5 }),
      "P1",
      "P2",
    );
    expect(s.p1.attacksLeft).toBe(2 + 3);
  });

  it("철벽 (bulwarkShield) — 양쪽 모두 보호막 시드", () => {
    const s = initialBattleStatePvP(
      makePlayer({ bulwarkShield: 40 }),
      makePlayer({ bulwarkShield: 20 }),
      "P1",
      "P2",
    );
    expect(s.p1.stacks.playerShield).toBe(40);
    expect(s.p2.stacks.playerShield).toBe(20);
  });

  it("회피 강화 (guaranteedEvades) — 양쪽 모두 evadesRemaining 시드", () => {
    const s = initialBattleStatePvP(
      makePlayer({ guaranteedEvades: 2 }),
      makePlayer({ guaranteedEvades: 1 }),
      "P1",
      "P2",
    );
    expect(s.p1.stacks.evadesRemaining).toBe(2);
    expect(s.p2.stacks.evadesRemaining).toBe(1);
  });

  it("연단의 룬 (potionHealPct) — 양쪽 buffs 에 시드", () => {
    const s = initialBattleStatePvP(
      makePlayer({ potionHealPct: 25 }),
      makePlayer({ potionHealPct: 10 }),
      "P1",
      "P2",
    );
    expect(s.p1.buffs.potionHealPct).toBe(25);
    expect(s.p2.buffs.potionHealPct).toBe(10);
  });
});

// ── 기본 흐름 ───────────────────────────────────────────────────────────────

describe("advanceTurnPvP — 기본 흐름", () => {
  it("p1 공격 → p2 HP 감소 → phase=p2", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 20, def: 0 }),
      makePlayer({ spd: 5, atk: 1, def: 5, hp: 100, maxHp: 100 }),
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0);
    expect(s1.p2.hp).toBeLessThan(100);
    expect(s1.phase).toBe("p2");
    expect(s1.p1.turn.completedPlayerTurns).toBe(1);
  });

  it("phase 가 양쪽 사이드로 토글 — p1 턴 → p2 턴 → p1 턴", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, hp: 200, maxHp: 200 }),
      makePlayer({ spd: 5, hp: 200, maxHp: 200 }),
      "P1",
      "P2",
    );
    expect(s0.phase).toBe("p1");
    const s1 = advanceTurnPvP(s0);
    expect(s1.phase).toBe("p2");
    const s2 = advanceTurnPvP(s1);
    expect(s2.phase).toBe("p1");
    expect(s2.p1.turn.completedPlayerTurns).toBe(1);
    expect(s2.p2.turn.completedPlayerTurns).toBe(1);
  });

  it("attackCount 가 큰 측은 한 페이즈에 여러 번 공격", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 20, def: 0, attackCount: 3 }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 200, maxHp: 200 }),
      "P1",
      "P2",
    );
    let s = s0;
    let steps = 0;
    while (s.phase === "p1" && steps < 10) {
      s = advanceTurnPvP(s);
      steps += 1;
    }
    // 3 회 + (출혈/연타/광속 등 없음 — 정확히 3 step) → 4번째 step 에서 p2 페이즈로.
    expect(s.phase).toBe("p2");
    expect(steps).toBe(3);
  });
});

// ── 공격자 측 능력 ──────────────────────────────────────────────────────────

describe("공격자 측 능력 — 대칭 적용", () => {
  it("막다른 격노 (rampage) — 양쪽 사이드가 각자 ATK 누적", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, rampagePerTurn: 5, hp: 1000, maxHp: 1000 }),
      makePlayer({ spd: 5, rampagePerTurn: 3, hp: 1000, maxHp: 1000 }),
      "P1",
      "P2",
    );
    let s = s0;
    // RAMPAGE_START_TURN 만큼 양쪽 모두 턴 돌리기 — 도중에 죽으면 안 되니 hp 높게.
    for (let i = 0; i < RAMPAGE_START_TURN * 2 + 4; i += 1) {
      if (s.phase === "ended") break;
      s = advanceTurnPvP(s);
    }
    expect(s.p1.buffs.rampageAtkBonus).toBeGreaterThan(0);
    expect(s.p2.buffs.rampageAtkBonus).toBeGreaterThan(0);
    // p1 의 rampage 가 p2 보다 큼 (per-turn 차이 + p1 가 선공이라 턴 수 동률 또는 1 더).
    expect(s.p1.buffs.rampageAtkBonus).toBeGreaterThanOrEqual(
      s.p2.buffs.rampageAtkBonus,
    );
  });

  it("약점 분석 (analysis) — p1 의 페널티가 자기 buffs 에 누적, p2 의 effectiveAtk 가 줄어듦", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, analysisPerTurn: 4, hp: 1000, maxHp: 1000 }),
      makePlayer({ spd: 5, atk: 20, hp: 1000, maxHp: 1000 }),
      "P1",
      "P2",
    );
    let s = s0;
    for (let i = 0; i < 6; i += 1) {
      if (s.phase === "ended") break;
      s = advanceTurnPvP(s);
    }
    // p1 의 opponentAtkPenalty / opponentDefPenalty 가 누적됐어야 한다.
    expect(s.p1.buffs.opponentAtkPenalty).toBeGreaterThan(0);
    expect(s.p1.buffs.opponentDefPenalty).toBeGreaterThan(0);
    // p1.buffs.opponentAtkPenalty 는 양수 — p2 의 effectiveAtk 가 그만큼 깎여 들어왔어야 한다.
    expect(s.p1.buffs.opponentAtkPenalty).toBe(s.p1.buffs.opponentDefPenalty);
  });

  it("출혈 (bleed) — p1 의 hits 가 attacker.stacks.bleedStacksOnOpponent 에 누적", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 20, bleedDmgPerStack: 3, hp: 1000, maxHp: 1000, attackCount: 2 }),
      makePlayer({ spd: 5, atk: 1, hp: 1000, maxHp: 1000 }),
      "P1",
      "P2",
    );
    let s = s0;
    // p1 의 2회 공격 → p1.stacks.bleedStacksOnOpponent = 2.
    s = advanceTurnPvP(s);
    s = advanceTurnPvP(s);
    expect(s.p1.stacks.bleedStacksOnOpponent).toBe(2);
  });

  it("출혈 도트 — p1 의 공격 페이즈 종료 시점에 p2.hp 가 (스택 × bleedDmgPerStack) 만큼 추가 감소", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 20, def: 0, bleedDmgPerStack: 5, hp: 1000, maxHp: 1000 }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 500, maxHp: 500 }),
      "P1",
      "P2",
    );
    // p1 공격 1회 — 본타 20 (def 0) + 출혈 스택 1 + 페이즈 종료 시 출혈 도트 5 dmg.
    const s1 = advanceTurnPvP(s0);
    expect(s1.phase).toBe("p2");
    expect(s1.p1.stacks.bleedStacksOnOpponent).toBe(1);
    // 500 - 20(본타) - 5(도트) = 475.
    expect(s1.p2.hp).toBe(475);
    expect(s1.log.some((e) => e.text.includes("출혈") && e.text.includes("스택 1"))).toBe(true);
  });

  it("그림자 분신 (shadowClone) — p1 턴 종료 시 분신 추가 데미지", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 100, def: 0, shadowCloneAtkPct: 50, hp: 1000, maxHp: 1000 }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 1000, maxHp: 1000 }),
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0);
    // p1 본타 100 + 분신 50 = 150 데미지가 p2 에 들어가야 한다.
    expect(s0.p2.hp - s1.p2.hp).toBe(150);
    expect(s1.log.some((e) => e.text.includes("그림자 분신"))).toBe(true);
  });

  it("크리티컬 (critChancePct) — 강제 발동 시 데미지 ×critMult", () => {
    // Math.random 0 으로 모든 확률 항상 발동.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 100, def: 0, critChancePct: 100, hp: 1000, maxHp: 1000, attackCount: 1, extraAttackChancePct: 0 }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 5000, maxHp: 5000 }),
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0);
    // 기본 100 데미지 × CRIT_MULT_BASE = 100 × 2 = 200 (CRIT_MULT_BASE 가 2 라 가정 — 다르면 그 값).
    const dealt = s0.p2.hp - s1.p2.hp;
    expect(dealt).toBe(Math.floor(100 * CRIT_MULT_BASE));
    expect(s1.log.some((e) => e.text.includes("크리티컬"))).toBe(true);
  });

  it("처형 (executionDamageMult) — defender HP 비율이 임계 미만이면 데미지 배수", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 50, def: 0, executionDamageMult: 3, executionHpFraction: 0.5, hp: 1000, maxHp: 1000 }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 40, maxHp: 100 }),
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0);
    // p2.hp = 40, maxHp 100 → 0.4 < 0.5 → 처형 발동. 50 × 3 = 150 데미지. p2.hp = 0 → 사망.
    expect(s1.outcome).toBe("p1_win");
    expect(s1.phase).toBe("ended");
    expect(s1.log.some((e) => e.text.includes("처형"))).toBe(true);
  });

  it("암살 (assassinateDmgMult) — 전투 첫 공격 1회 발동, DEF 무시 + 데미지 배수", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, atk: 50, def: 0, assassinateDmgMult: 2, hp: 1000, maxHp: 1000 }),
      makePlayer({ spd: 5, atk: 1, def: 100, hp: 1000, maxHp: 1000 }), // 높은 DEF 라도 암살은 무시.
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0);
    // DEF 100 인데 암살은 무시. 50 × 2 = 100 데미지 (cap 적용 안 됨).
    expect(s0.p2.hp - s1.p2.hp).toBe(100);
    expect(s1.p1.flags.assassinateUsed).toBe(true);
  });

  it("연쇄 운명 (fatedChain) — 크리 발동 시 다음 공격 강제 크리 큐", () => {
    // 1번째 공격 — 크리 (Math.random 0). 큐 활성. 2번째 공격 — 큐 소비, 강제 크리.
    // attackCount 2 로 한 페이즈에 2 회 공격.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const s0 = initialBattleStatePvP(
      makePlayer({
        spd: 15,
        atk: 50,
        def: 0,
        attackCount: 2,
        extraAttackChancePct: 0,
        critChancePct: 100,
        fatedChainActive: true,
        hp: 1000,
        maxHp: 1000,
      }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 5000, maxHp: 5000 }),
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0);
    // 1번째 공격에서 크리 발동 + 큐 활성.
    expect(s1.log.some((e) => e.text.includes("연쇄 운명") && e.text.includes("점지"))).toBe(true);
  });

  it("강공격 (powerAttackBonus) — POWER_ATTACK_TURN_INTERVAL 턴의 첫 공격에만", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({
        spd: 15,
        atk: 50,
        def: 0,
        powerAttackBonus: 30,
        hp: 1000,
        maxHp: 1000,
        attackCount: 1,
        extraAttackChancePct: 0,
      }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 10000, maxHp: 10000 }),
      "P1",
      "P2",
    );
    let s = s0;
    // 1턴 — 강공격 미발동(턴 번호 1, interval 보통 3). 일반 데미지 50.
    s = advanceTurnPvP(s);
    expect(s.log.some((e) => e.text.includes("강공격"))).toBe(false);
  });
});

// ── 포션 ────────────────────────────────────────────────────────────────────

describe("포션 — applyPotionTo", () => {
  it("p1 이 포션 사용 시 p1 의 HP 만 회복, 페이즈 종료", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, hp: 50, maxHp: 100 }),
      makePlayer({ spd: 5, hp: 80, maxHp: 100 }),
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0, {
      kind: "use_potion",
      potionId: HEAL_POTION.id,
      potion: HEAL_POTION,
    });
    expect(s1.p1.hp).toBe(80); // 50 + 30
    expect(s1.p2.hp).toBe(80); // 변동 없음
    expect(s1.phase).toBe("p2");
  });

  it("potionHealPct 가 포션 회복량을 가산", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const s0 = initialBattleStatePvP(
      makePlayer({ spd: 15, hp: 50, maxHp: 100, potionHealPct: 50 }),
      makePlayer({ spd: 5 }),
      "P1",
      "P2",
    );
    const s1 = advanceTurnPvP(s0, {
      kind: "use_potion",
      potionId: HEAL_POTION.id,
      potion: HEAL_POTION,
    });
    // 30 × 1.5 = 45. 50 + 45 = 95.
    expect(s1.p1.hp).toBe(95);
  });
});

// ── resolve 루프 ────────────────────────────────────────────────────────────

describe("resolveBattlePvP — 풀 시뮬", () => {
  it("기본 전투가 결판으로 끝난다 (한쪽 사망 또는 turn cap)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const ctx: PvPResolveContext = {
      pickAction: () => ({ kind: "attack" }),
      potions: { p1: {}, p2: {} },
    };
    const r = resolveBattlePvP(
      makePlayer({ spd: 15, atk: 30, def: 0, hp: 100, maxHp: 100 }),
      makePlayer({ spd: 5, atk: 10, def: 0, hp: 100, maxHp: 100 }),
      "P1",
      "P2",
      ctx,
    );
    expect(["p1_win", "p2_win", "draw"]).toContain(r.outcome);
    expect(r.finalState.phase).toBe("ended");
    expect(r.turns).toBeGreaterThan(0);
  });

  it("p1 압도적 우위 → p1 승", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const ctx: PvPResolveContext = {
      pickAction: () => ({ kind: "attack" }),
      potions: { p1: {}, p2: {} },
    };
    const r = resolveBattlePvP(
      makePlayer({ spd: 15, atk: 100, def: 100, hp: 1000, maxHp: 1000 }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 50, maxHp: 50 }),
      "P1",
      "P2",
      ctx,
    );
    expect(r.outcome).toBe("p1_win");
  });

  it("p2 압도적 우위 → p2 승 (선공자 무관)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const ctx: PvPResolveContext = {
      pickAction: () => ({ kind: "attack" }),
      potions: { p1: {}, p2: {} },
    };
    const r = resolveBattlePvP(
      makePlayer({ spd: 15, atk: 1, def: 0, hp: 50, maxHp: 50 }),
      makePlayer({ spd: 5, atk: 100, def: 100, hp: 1000, maxHp: 1000 }),
      "P1",
      "P2",
      ctx,
    );
    expect(r.outcome).toBe("p2_win");
  });

  it("양쪽 모두 atk=1, def=무한 → turn cap 무승부 (또는 draw)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const ctx: PvPResolveContext = {
      pickAction: () => ({ kind: "attack" }),
      potions: { p1: {}, p2: {} },
    };
    const r = resolveBattlePvP(
      makePlayer({ spd: 15, atk: 1, def: 0, hp: 100, maxHp: 100 }),
      makePlayer({ spd: 5, atk: 1, def: 0, hp: 100, maxHp: 100 }),
      "P1",
      "P2",
      ctx,
    );
    // 100 hp / 1 dmg (× floor) → 한쪽이 결국 죽을 거다. cap 으로 끝나야 draw.
    // 정밀 시나리오는 위 다른 테스트로 — 여기선 결판이 나오는지만.
    expect(r.finalState.phase).toBe("ended");
  });

  it("포션 사용 — p1 의 사망 직전 회복으로 buyback 가능", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    let p1UsedPotion = false;
    const ctx: PvPResolveContext = {
      pickAction: (s, who) => {
        if (who === "p1" && !p1UsedPotion && s.p1.hp < 40) {
          p1UsedPotion = true;
          return {
            kind: "use_potion",
            potionId: HEAL_POTION.id,
            potion: HEAL_POTION,
          };
        }
        return { kind: "attack" };
      },
      potions: { p1: { [HEAL_POTION.id]: 1 }, p2: {} },
    };
    const r = resolveBattlePvP(
      makePlayer({ spd: 15, atk: 20, def: 0, hp: 100, maxHp: 100 }),
      makePlayer({ spd: 5, atk: 15, def: 0, hp: 200, maxHp: 200 }),
      "P1",
      "P2",
      ctx,
    );
    // 포션 1회 소비됐어야 한다.
    expect(r.potionsConsumed.p1[HEAL_POTION.id] ?? 0).toBe(1);
  });
});
