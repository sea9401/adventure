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

  describe("턴 마커에 AP 표기", () => {
    it("AP 미장착이면 평소 '${N}턴' 그대로", () => {
      const r = resolveBattle(PLAYER, enemy(50), "용사", {
        pickAction: () => ({ kind: "attack" }),
        potions: {},
      });
      const markers = r.finalState.log.filter((e) => e.kind === "turn_marker");
      expect(markers.length).toBeGreaterThan(0);
      for (const m of markers) {
        expect(m.text).toMatch(/^\d+턴$/);
        expect(m.text).not.toContain("AP");
      }
    });

    it("AP 장착 시 '${N}턴 · AP X' 표기", () => {
      const p: PlayerCombat = { ...PLAYER, equippedAPSkills: [SHADOW_CUT] };
      const r = resolveBattle(p, enemy(50), "용사", {
        pickAction: () => ({ kind: "attack" }),
        potions: {},
      });
      const markers = r.finalState.log.filter((e) => e.kind === "turn_marker");
      expect(markers.length).toBeGreaterThan(0);
      // 첫 턴 마커는 시작 AP 2.
      expect(markers[0].text).toBe("1턴 · AP 2");
      // 이후 마커는 형식만 검증 (값은 발동·회복 흐름에 따라 다름).
      for (const m of markers.slice(1)) {
        expect(m.text).toMatch(/^\d+턴 · AP \d+$/);
      }
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
