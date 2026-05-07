import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advanceTurn,
  appendLog,
  applyPotionEffect,
  damageBetween,
  initialBattleState,
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
