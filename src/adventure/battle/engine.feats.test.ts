import { describe, it, expect } from "vitest";
import { advanceTurn, initialBattleState, type PlayerCombat } from "./engine";
import type { Monster } from "../data/monsters";

// 기본: atk 10, def 5, spd 10 — 적(atk 8, def 3, spd 5)보다 빠름 → 항상 선공.
// 적 회피 0 / 추가공격 확률 0 → 결정적. damageBetween(10,3)=7, damageBetween(8,5)=3.
const PLAYER: PlayerCombat = {
  hp: 50,
  maxHp: 50,
  atk: 10,
  def: 5,
  spd: 10,
  evasionPct: 0,
  attackCount: 1,
};

function enemy(hp = 100): Monster {
  return { name: "적", tags: ["beast"], hp, atk: 8, def: 3, spd: 5, exp: 5 };
}

describe("특기 — 광전사", () => {
  it("잃은 HP 비율만큼 ATK 가산 (HP 절반 → +25%)", () => {
    const p: PlayerCombat = {
      ...PLAYER,
      hp: 25, // 50% 손실
      maxHp: 50,
      berserkAtkPctPerLostHpPct: 0.5,
    };
    let s = initialBattleState(p, enemy(100), "용사");
    s = advanceTurn(s, p, "용사"); // berserkBonus = floor(10 × 0.5 × 0.5)=2 → damageBetween(12,3)=9 → 91
    expect(s.enemyHp).toBe(91);
  });
});

describe("특기 — 암살", () => {
  it("전투 첫 공격: 적 DEF 무시 + 데미지 ×2, 그 뒤 공격은 정상", () => {
    const p: PlayerCombat = { ...PLAYER, assassinateDmgMult: 2 };
    let s = initialBattleState(p, enemy(100), "용사");
    s = advanceTurn(s, p, "용사"); // DEF무시 baseDmg=10, ×2 → 20 → 80
    expect(s.enemyHp).toBe(80);
    expect(s.assassinateUsed).toBe(true);
    s = advanceTurn(s, p, "용사"); // 적 턴
    s = advanceTurn(s, p, "용사"); // 2턴: 암살 소진 → damageBetween(10,3)=7 → 73
    expect(s.enemyHp).toBe(73);
  });
});

describe("특기 — 질풍검", () => {
  it("턴 첫 공격에 그 턴 공격 횟수만큼 ATK 보너스", () => {
    const p: PlayerCombat = { ...PLAYER, attackCount: 2, gustAtkPerAttack: 1 };
    let s = initialBattleState(p, enemy(100), "용사");
    s = advanceTurn(s, p, "용사"); // 1타: +2(횟수2) → damageBetween(12,3)=9 → 91
    expect(s.enemyHp).toBe(91);
    s = advanceTurn(s, p, "용사"); // 2타: 보너스 없음 → damageBetween(10,3)=7 → 84
    expect(s.enemyHp).toBe(84);
  });
});

describe("특기 — 연참", () => {
  it("그 턴 크리티컬 나면 추가 공격 1회 (턴당 1회)", () => {
    const p: PlayerCombat = {
      ...PLAYER,
      critChancePct: 100,
      critMult: 2,
      riposteExtra: 1,
    };
    let s = initialBattleState(p, enemy(100), "용사");
    s = advanceTurn(s, p, "용사"); // 크리 14 → 86, 연참 발동 → 다시 player phase
    expect(s.enemyHp).toBe(86);
    expect(s.phase).toBe("player");
    expect(s.riposteUsedThisTurn).toBe(true);
    s = advanceTurn(s, p, "용사"); // 연참 추가타: 크리 14 → 72, 더 이상 연참 X → 적 턴으로
    expect(s.enemyHp).toBe(72);
    expect(s.phase).toBe("enemy");
  });
});

describe("특기 — 유격", () => {
  it("회피 성공 시 다음 플레이어 턴 공격 횟수 +1", () => {
    const p: PlayerCombat = { ...PLAYER, evasionPct: 100, skirmishNextTurnBonus: 1 };
    let s = initialBattleState(p, enemy(100), "용사");
    s = advanceTurn(s, p, "용사"); // 1턴: 7 → 93, 다음 턴 선롤 playerAttacksLeft=1
    s = advanceTurn(s, p, "용사"); // 적 턴: 회피 (100%) → playerAttacksLeft 1+1=2
    expect(s.playerAttacksLeft).toBe(2);
    s = advanceTurn(s, p, "용사"); // 2턴 1타: 7 → 86
    s = advanceTurn(s, p, "용사"); // 2턴 2타: 7 → 79
    expect(s.enemyHp).toBe(79);
  });
});

describe("특기 — 반사 갑주", () => {
  it("피격 시 받은 피해의 N% 를 적에게 반사", () => {
    const p: PlayerCombat = { ...PLAYER, thornsPct: 50 };
    let s = initialBattleState(p, enemy(100), "용사");
    s = advanceTurn(s, p, "용사"); // 1턴: 7 → 93
    s = advanceTurn(s, p, "용사"); // 적 턴: 적 공격 3 → 플레이어 47, 반사 floor(3×0.5)=1 → 적 92
    expect(s.playerHp).toBe(47);
    expect(s.enemyHp).toBe(92);
    expect(s.damageTakenThisCombat).toBe(3);
  });
});
