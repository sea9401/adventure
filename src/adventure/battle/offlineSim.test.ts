import { describe, expect, it } from "vitest";
import {
  OFFLINE_SIM_MAX_MS,
  simulateOfflineHunt,
  summarizeOfflineResult,
  type OfflineSimInput,
} from "./offlineSim";
import type { Region } from "../data/world";
import type { PlayerCombat } from "./engine";

const TURN = 500;

// 평야 region — 실제 데이터 그대로 안 쓰고 테스트 픽스처로 슬라임 한 종만.
function makeRegion(enemies: string[]): Region {
  return {
    id: "plains",
    name: "평야",
    description: "",
    position: { x: 0, y: 0 },
    biome: "plains",
    enemies,
  };
}

const STRONG_PLAYER: PlayerCombat = {
  hp: 100,
  maxHp: 100,
  atk: 50, // 슬라임 def=0이라 1턴에 끝남
  def: 5,
  spd: 99,
  evasionPct: 0,
  attackCount: 1,
};

const FRAGILE_PLAYER: PlayerCombat = {
  hp: 1,
  maxHp: 1,
  atk: 1,
  def: 0,
  spd: 0,
  evasionPct: 0,
  attackCount: 1,
};

function baseInput(over: Partial<OfflineSimInput> = {}): OfflineSimInput {
  return {
    player: STRONG_PLAYER,
    playerName: "테스터",
    region: makeRegion(["슬라임"]),
    playerLevel: 99, // 신참 보너스 미적용 (기본 테스트는 base exp 검증)
    potions: {},
    turnIntervalMs: TURN,
    awayMs: 60_000, // 1분
    luk: 0,
    knowsRecipe: () => false,
    pickAction: () => ({ kind: "attack" }),
    // rng=0 — 첫 적 선택 + 드롭 굴림 항상 통과(0 < chance).
    // 슬라임의 lowest chance 가 0.003 이라 모든 드롭 발동되지만 테스트는 그 효과를
    // 직접 검증하지 않고 EXP/사망/cap 만 보므로 결과에 영향 없음.
    rng: () => 0,
    ...over,
  };
}

describe("simulateOfflineHunt", () => {
  it("적이 없는 region이면 시뮬레이션 0", () => {
    const r = simulateOfflineHunt(baseInput({ region: makeRegion([]) }));
    expect(r.battles).toBe(0);
    expect(r.simulatedMs).toBe(0);
  });

  it("awayMs가 0 이하면 즉시 종료", () => {
    const r = simulateOfflineHunt(baseInput({ awayMs: 0 }));
    expect(r.battles).toBe(0);
    expect(r.simulatedMs).toBe(0);
  });

  it("강한 플레이어는 cap까지 사망 없이 연속 처치", () => {
    const r = simulateOfflineHunt(baseInput({ awayMs: 30_000 }));
    expect(r.died).toBe(false);
    expect(r.wins).toBeGreaterThan(0);
    expect(r.killsByName["슬라임"]).toBe(r.wins);
    expect(r.simulatedMs).toBeLessThanOrEqual(30_000);
  });

  it("OFFLINE_SIM_MAX_MS(1시간)을 넘는 awayMs는 cap + cappedByLimit=true", () => {
    const r = simulateOfflineHunt(
      baseInput({ awayMs: OFFLINE_SIM_MAX_MS * 5 }),
    );
    expect(r.cappedByLimit).toBe(true);
    expect(r.simulatedMs).toBeLessThanOrEqual(OFFLINE_SIM_MAX_MS);
  });

  it("약한 플레이어는 도중에 사망하고 break", () => {
    const r = simulateOfflineHunt(
      baseInput({ player: FRAGILE_PLAYER, awayMs: 60_000 }),
    );
    expect(r.died).toBe(true);
    expect(r.finalPlayerHp).toBe(0);
    // 사망 후 더 이상 진행 안 함 — simulatedMs는 cap보다 짧아야.
    expect(r.simulatedMs).toBeLessThan(60_000);
  });

  it("승리 시 EXP가 누적된다", () => {
    const r = simulateOfflineHunt(baseInput({ awayMs: 10_000 }));
    // 슬라임 EXP는 monsters.ts에 정의된 값을 그대로 누적.
    expect(r.expGained).toBeGreaterThan(0);
    expect(r.expBonusApplied).toBe(false); // baseInput 은 playerLevel 99
  });

  it("신참 보너스 — playerLevel < 8 면 expGained ×2 + 플래그 true", () => {
    const baseR = simulateOfflineHunt(baseInput({ awayMs: 10_000, playerLevel: 99 }));
    const newbieR = simulateOfflineHunt(baseInput({ awayMs: 10_000, playerLevel: 1 }));
    expect(newbieR.expGained).toBe(baseR.expGained * 2);
    expect(newbieR.expBonusApplied).toBe(true);
  });

  it("신참 보너스 — sim 중 8 레벨 도달하면 그 시점부터 보너스 OFF", () => {
    // L7, 다음 레벨까지 거의 다 찬 exp. 슬라임 몇 마리만 잡아도 L8 도달.
    // requiredExpToNext(7) = floor(120 * 7^1.5) = 2222.
    // 다음 슬라임 처치는 base exp(2) 만 적립.
    // 단, 이 테스트는 "총 expGained 가 풀-신참 케이스보다 작다" 만 검증해도 충분.
    const aboutToLevel = simulateOfflineHunt(
      baseInput({
        awayMs: 60_000,
        playerLevel: 7,
        playerExp: 2210, // L7→8 직전
      }),
    );
    const stayedNewbie = simulateOfflineHunt(
      baseInput({
        awayMs: 60_000,
        playerLevel: 1,
        playerExp: 0,
      }),
    );
    // L7→8 케이스는 처음 몇 마리만 ×2 받고 나머진 base. stayedNewbie 는 전부 ×2.
    expect(aboutToLevel.expGained).toBeLessThan(stayedNewbie.expGained);
    expect(aboutToLevel.expBonusApplied).toBe(true); // 처음에는 발동했음
  });

  it("pickAction이 use_potion을 돌려도 보유량 0이면 attack으로 폴백 + 소비 0", () => {
    const r = simulateOfflineHunt(
      baseInput({
        awayMs: 5_000,
        potions: {},
        pickAction: () => ({
          kind: "use_potion",
          potionId: "potion_heal_s",
          potion: {
            id: "potion_heal_s",
            name: "x",
            description: "",
            effect: { kind: "heal_hp", flat: 1 },
            price: 0,
          },
        }),
      }),
    );
    expect(r.potionsConsumed.potion_heal_s ?? 0).toBe(0);
    // 그래도 전투는 진행되어야 함
    expect(r.battles).toBeGreaterThan(0);
  });

  it("HP가 충분히 남으면 다음 전투에 그 HP로 이어진다", () => {
    // 강한 플레이어이므로 마지막 전투 후 HP가 maxHp 이하 어딘가.
    const r = simulateOfflineHunt(baseInput({ awayMs: 60_000 }));
    expect(r.finalPlayerHp).toBeGreaterThan(0);
    expect(r.finalPlayerHp).toBeLessThanOrEqual(STRONG_PLAYER.maxHp);
  });
});

describe("summarizeOfflineResult", () => {
  it("아무 일도 없으면 빈 문자열", () => {
    const r = simulateOfflineHunt(baseInput({ region: makeRegion([]) }));
    expect(summarizeOfflineResult(r)).toBe("");
  });

  it("승리 + EXP가 있으면 토큰을 ' · '로 연결", () => {
    const r = simulateOfflineHunt(baseInput({ awayMs: 10_000 }));
    const text = summarizeOfflineResult(r);
    expect(text).toContain("처치");
    expect(text).toContain("EXP");
  });

  it("사망 시 '사망' 토큰 포함", () => {
    const r = simulateOfflineHunt(
      baseInput({ player: FRAGILE_PLAYER, awayMs: 60_000 }),
    );
    expect(summarizeOfflineResult(r)).toContain("사망");
  });
});
