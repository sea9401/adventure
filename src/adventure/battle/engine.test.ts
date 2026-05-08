import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advanceTurn,
  appendLog,
  applyPotionEffect,
  damageBetween,
  initialBattleState,
  resolveBattle,
  type BattleLogEntry,
  type PlayerCombat,
} from "./engine";
import type { Monster } from "../data/monsters";
import type { Potion } from "../data/potions";

const PLAYER: PlayerCombat = {
  hp: 50,
  maxHp: 50,
  atk: 10,
  def: 5,
  spd: 10,
  evasionPct: 0,
  attackCount: 1,
};

function makeEnemy(over: Partial<Monster> = {}): Monster {
  return {
    name: "테스트적",
    tags: ["beast"],
    hp: 30,
    atk: 8,
    def: 3,
    spd: 5,
    exp: 5,
    ...over,
  };
}

const HEAL_POTION: Potion = {
  id: "potion_heal_s",
  name: "테스트 회복약",
  description: "",
  effect: { kind: "heal_hp", flat: 20 },
  price: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("damageBetween", () => {
  it("atk-def, 최소 1", () => {
    expect(damageBetween(10, 3)).toBe(7);
    expect(damageBetween(3, 10)).toBe(1);
    expect(damageBetween(5, 5)).toBe(1);
  });
});

describe("appendLog", () => {
  it("로그를 누적하되 LOG_LIMIT(8) 초과분은 앞에서 잘라낸다", () => {
    let log: BattleLogEntry[] = [];
    for (let i = 0; i < 10; i += 1) {
      log = appendLog(log, { kind: "info", text: `${i}` });
    }
    expect(log.length).toBe(8);
    expect(log[0].text).toBe("2");
    expect(log[7].text).toBe("9");
  });
});

describe("initialBattleState", () => {
  it("플레이어 SPD가 더 높으면 player phase로 시작", () => {
    const s = initialBattleState(PLAYER, makeEnemy({ spd: 3 }), "P");
    expect(s.phase).toBe("player");
  });

  it("SPD 동점이면 플레이어 우선", () => {
    const s = initialBattleState(PLAYER, makeEnemy({ spd: PLAYER.spd }), "P");
    expect(s.phase).toBe("player");
  });

  it("적 SPD가 더 높으면 enemy phase", () => {
    const s = initialBattleState(PLAYER, makeEnemy({ spd: 99 }), "P");
    expect(s.phase).toBe("enemy");
  });
});

describe("advanceTurn (player phase, attack)", () => {
  it("적 HP를 깎고 enemy phase로 넘어간다", () => {
    const s0 = initialBattleState(PLAYER, makeEnemy(), "P");
    const s1 = advanceTurn(s0, PLAYER, "P");
    expect(s1.enemyHp).toBe(30 - damageBetween(PLAYER.atk, 3));
    expect(s1.phase).toBe("enemy");
    expect(s1.outcome).toBeNull();
  });

  it("적을 처치하면 outcome=win, phase=ended", () => {
    const enemy = makeEnemy({ hp: 1 });
    const s0 = initialBattleState(PLAYER, enemy, "P");
    const s1 = advanceTurn(s0, PLAYER, "P");
    expect(s1.enemyHp).toBe(0);
    expect(s1.phase).toBe("ended");
    expect(s1.outcome).toBe("win");
  });

  it("attackCount > 1이면 같은 player phase에서 연속 공격", () => {
    const fast: PlayerCombat = { ...PLAYER, attackCount: 2 };
    const s0 = initialBattleState(fast, makeEnemy({ hp: 100 }), "P");
    const s1 = advanceTurn(s0, fast, "P");
    expect(s1.phase).toBe("player");
    expect(s1.playerAttacksLeft).toBe(1);
    const s2 = advanceTurn(s1, fast, "P");
    expect(s2.phase).toBe("enemy");
  });
});

describe("advanceTurn (enemy phase)", () => {
  it("회피 성공 시 데미지 없이 player phase로 복귀", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // 0 < evasionPct = 회피
    const dodgy: PlayerCombat = { ...PLAYER, evasionPct: 100 };
    const s0 = { ...initialBattleState(dodgy, makeEnemy(), "P"), phase: "enemy" as const };
    const s1 = advanceTurn(s0, dodgy, "P");
    expect(s1.playerHp).toBe(dodgy.hp);
    expect(s1.phase).toBe("player");
  });

  it("회피 실패 시 데미지를 입고 player phase", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // evasionPct=0이면 무조건 피격
    const enemy = makeEnemy();
    const s0 = { ...initialBattleState(PLAYER, enemy, "P"), phase: "enemy" as const };
    const s1 = advanceTurn(s0, PLAYER, "P");
    expect(s1.playerHp).toBe(PLAYER.hp - damageBetween(enemy.atk, PLAYER.def));
    expect(s1.phase).toBe("player");
  });

  it("HP가 0 이하가 되면 outcome=lose", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const fragile: PlayerCombat = { ...PLAYER, hp: 1, def: 0 };
    const s0 = {
      ...initialBattleState(fragile, makeEnemy({ atk: 50 }), "P"),
      phase: "enemy" as const,
    };
    const s1 = advanceTurn(s0, fragile, "P");
    expect(s1.playerHp).toBe(0);
    expect(s1.phase).toBe("ended");
    expect(s1.outcome).toBe("lose");
  });
});

describe("applyPotionEffect", () => {
  it("flat heal은 maxHp를 넘지 않는다", () => {
    const s0 = initialBattleState(
      { ...PLAYER, hp: 45 },
      makeEnemy(),
      "P",
    );
    const s1 = applyPotionEffect(s0, HEAL_POTION, "P");
    expect(s1.playerHp).toBe(50);
  });

  it("플레이어 phase에서 use_potion 후 enemy phase로 전환", () => {
    const s0 = initialBattleState({ ...PLAYER, hp: 10 }, makeEnemy(), "P");
    const s1 = advanceTurn(s0, PLAYER, "P", {
      kind: "use_potion",
      potionId: HEAL_POTION.id,
      potion: HEAL_POTION,
    });
    expect(s1.playerHp).toBe(30);
    expect(s1.phase).toBe("enemy");
  });
});

describe("resolveBattle", () => {
  it("강한 플레이어는 승리 + 적 HP 0", () => {
    const r = resolveBattle(PLAYER, makeEnemy(), "P", {
      pickAction: () => ({ kind: "attack" }),
      potions: {},
    });
    expect(r.outcome).toBe("win");
    expect(r.finalState.phase).toBe("ended");
    expect(r.finalState.enemyHp).toBe(0);
    expect(r.turns).toBeGreaterThan(0);
  });

  it("약한 플레이어는 패배 + final HP 0", () => {
    const fragile: PlayerCombat = { ...PLAYER, hp: 1, def: 0 };
    vi.spyOn(Math, "random").mockReturnValue(0.99); // 회피 실패
    const r = resolveBattle(fragile, makeEnemy({ atk: 50 }), "P", {
      pickAction: () => ({ kind: "attack" }),
      potions: {},
    });
    expect(r.outcome).toBe("lose");
    expect(r.finalState.playerHp).toBe(0);
  });

  it("포션 보유량을 추적, 부족하면 attack으로 폴백", () => {
    const r = resolveBattle(PLAYER, makeEnemy({ hp: 100 }), "P", {
      pickAction: () => ({
        kind: "use_potion",
        potionId: "potion_heal_s",
        potion: HEAL_POTION,
      }),
      potions: { potion_heal_s: 1 },
    });
    expect(r.potionsConsumed.potion_heal_s).toBe(1);
  });

  it("포션 0개면 소비 0, attack으로 진행", () => {
    const r = resolveBattle(PLAYER, makeEnemy(), "P", {
      pickAction: () => ({
        kind: "use_potion",
        potionId: "potion_heal_s",
        potion: HEAL_POTION,
      }),
      potions: {},
    });
    expect(r.potionsConsumed.potion_heal_s ?? 0).toBe(0);
    expect(r.outcome).toBe("win"); // 폴백 attack으로 어쨌든 진행
  });

  it("로그가 LOG_LIMIT(8)을 넘지 않는다", () => {
    const r = resolveBattle(PLAYER, makeEnemy({ hp: 200 }), "P", {
      pickAction: () => ({ kind: "attack" }),
      potions: {},
    });
    expect(r.finalState.log.length).toBeLessThanOrEqual(8);
    expect(r.turns).toBeGreaterThan(8); // 잘려야 의미 있음
  });
});

describe("강공격 (powerAttackBonus)", () => {
  // 적 def 0, 플레이어 atk 1 → 일반 공격 1 데미지 / 강공격 (atk+2) = 3 데미지.
  const minimal: PlayerCombat = {
    ...PLAYER,
    atk: 1,
    spd: 100, // 항상 선공
    powerAttackBonus: 2,
  };
  const enemy = makeEnemy({ def: 0, hp: 100, atk: 0 });

  it("3턴마다 첫 공격이 ATK+2 로 발동", () => {
    let s = initialBattleState(minimal, enemy, "P");
    // turn 1 공격 → 일반 (1 dmg), enemy 공격, turn 2 공격 → 일반 (1 dmg), ...
    s = advanceTurn(s, minimal, "P"); // turn 1 — player attack
    s = advanceTurn(s, minimal, "P"); // turn 1 — enemy
    s = advanceTurn(s, minimal, "P"); // turn 2 — player attack
    s = advanceTurn(s, minimal, "P"); // turn 2 — enemy
    s = advanceTurn(s, minimal, "P"); // turn 3 — player attack (강공격 발동)
    const lastPlayerAttack = [...s.log]
      .reverse()
      .find((e) => e.kind === "player_attack")!;
    expect(lastPlayerAttack.text).toContain("[강공격]");
    expect(lastPlayerAttack.text).toContain("3 피해");
  });

  it("turn 1, 2, 4, 5 의 공격은 일반 — 강공격 마커 없음", () => {
    let s = initialBattleState(minimal, enemy, "P");
    const observed: string[] = [];
    for (let turn = 1; turn <= 7; turn += 1) {
      s = advanceTurn(s, minimal, "P"); // player
      const last = [...s.log].reverse().find((e) => e.kind === "player_attack");
      if (last) observed.push(`t${turn}:${last.text.includes("[강공격]") ? "POWER" : "NORMAL"}`);
      s = advanceTurn(s, minimal, "P"); // enemy
    }
    // 강공격 = turn 3, 6
    expect(observed).toEqual([
      "t1:NORMAL",
      "t2:NORMAL",
      "t3:POWER",
      "t4:NORMAL",
      "t5:NORMAL",
      "t6:POWER",
      "t7:NORMAL",
    ]);
  });

  it("powerAttackBonus 미설정(undefined) 시 강공격 발동 안 함", () => {
    const noSkill: PlayerCombat = { ...minimal, powerAttackBonus: undefined };
    let s = initialBattleState(noSkill, enemy, "P");
    for (let i = 0; i < 6; i += 1) s = advanceTurn(s, noSkill, "P");
    const playerAttacks = s.log.filter((e) => e.kind === "player_attack");
    for (const a of playerAttacks) expect(a.text).not.toContain("[강공격]");
  });

  it("attackCount 2 일 때 강공격은 첫 공격에만 적용", () => {
    const dual: PlayerCombat = { ...minimal, attackCount: 2 };
    let s = initialBattleState(dual, enemy, "P");
    // turn 3 까지 진행 (turn 3 = power turn)
    s = advanceTurn(s, dual, "P"); // turn 1 — attack 1
    s = advanceTurn(s, dual, "P"); // turn 1 — attack 2
    s = advanceTurn(s, dual, "P"); // turn 1 — enemy
    s = advanceTurn(s, dual, "P"); // turn 2 — attack 1
    s = advanceTurn(s, dual, "P"); // turn 2 — attack 2
    s = advanceTurn(s, dual, "P"); // turn 2 — enemy
    s = advanceTurn(s, dual, "P"); // turn 3 — attack 1 (강공격)
    s = advanceTurn(s, dual, "P"); // turn 3 — attack 2 (일반)
    const playerAttacks = s.log.filter((e) => e.kind === "player_attack");
    const recent = playerAttacks.slice(-2);
    expect(recent[0].text).toContain("[강공격]");
    expect(recent[1].text).not.toContain("[강공격]");
  });
});
