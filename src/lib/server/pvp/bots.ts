// PvP 봇 로스터 — 실제 매칭 풀이 빌 때 fallback 으로 사용.
//
// 디자인 원칙:
//   - 봇 ID 는 "bot:<slug>" 형식. users 테이블에 같은 ID 로 row 가 lazy upsert 됨 (pvp_matches FK 충족).
//   - 봇의 rating 은 고정 (Elo 업데이트 안 함). 챌린저의 rating 만 움직임.
//   - 봇은 pvp_ratings 에 row 없음 → 자연스럽게 시즌 순위표에 안 뜸.
//   - 봇은 saves_kv 에 캐릭터 save 없음 → fetchCandidatePool 의 inner join 으로 자연 제외 (인간 풀과 겹치지 않음).
//   - 이름은 "투기장의 …" 테마 — 인간 닉네임과 충돌 가능성 최소화. 충돌해도 ON CONFLICT DO NOTHING 으로 그 봇만 skip.
//
// 스탯은 레벨 시스템 (HP 97 + 5×(L-1)) 을 참고해 rating 별로 거칠게 매핑.
// 능력 효과는 1~2개만 부여해 캐릭터성 — 모두 균등 빌드면 무미건조.

import type { PlayerCombat } from "@/adventure/battle/engine";
import { db } from "@/db";
import { users } from "@/db/schema";

export type BotEntry = {
  id: string;
  name: string;
  rating: number;
  player: PlayerCombat;
};

// 모든 봇이 공통으로 갖는 빈 슬롯들 — 명시적으로 적어 둬 PlayerCombat 타입 진화 시 누락 추적이 쉬움.
const EMPTY_BUILD: Pick<PlayerCombat, "extraAttackChancePct"> = {
  extraAttackChancePct: 0,
};

export const BOTS: readonly BotEntry[] = [
  {
    id: "bot:apprentice",
    name: "투기장의 견습생",
    rating: 800,
    player: {
      ...EMPTY_BUILD,
      hp: 200,
      maxHp: 200,
      atk: 22,
      def: 8,
      spd: 8,
      evasionPct: 3,
      attackCount: 1,
    },
  },
  {
    id: "bot:wanderer",
    name: "투기장의 떠돌이",
    rating: 950,
    player: {
      ...EMPTY_BUILD,
      hp: 300,
      maxHp: 300,
      atk: 32,
      def: 14,
      spd: 12,
      evasionPct: 8,
      attackCount: 1,
      extraAttackChancePct: 10,
    },
  },
  {
    id: "bot:hunter",
    name: "투기장의 사냥꾼",
    rating: 1100,
    player: {
      ...EMPTY_BUILD,
      hp: 380,
      maxHp: 380,
      atk: 48,
      def: 18,
      spd: 18,
      evasionPct: 12,
      attackCount: 1,
      extraAttackChancePct: 25,
      critChancePct: 8,
    },
  },
  {
    id: "bot:knight",
    name: "투기장의 기사",
    rating: 1200,
    player: {
      ...EMPTY_BUILD,
      hp: 600,
      maxHp: 600,
      atk: 50,
      def: 38,
      spd: 14,
      evasionPct: 6,
      attackCount: 1,
      guard: { turns: 3, reduction: 8 },
    },
  },
  {
    id: "bot:duelist",
    name: "투기장의 결투사",
    rating: 1300,
    player: {
      ...EMPTY_BUILD,
      hp: 520,
      maxHp: 520,
      atk: 75,
      def: 25,
      spd: 25,
      evasionPct: 18,
      attackCount: 1,
      counterAtkBonus: 30,
      extraAttackChancePct: 30,
    },
  },
  {
    id: "bot:warrior",
    name: "투기장의 무사",
    rating: 1400,
    player: {
      ...EMPTY_BUILD,
      hp: 800,
      maxHp: 800,
      atk: 90,
      def: 50,
      spd: 22,
      evasionPct: 10,
      attackCount: 2,
      powerAttackBonus: 35,
      regen: { interval: 3, amount: 20 },
    },
  },
  {
    id: "bot:rogue",
    name: "투기장의 도적",
    rating: 1500,
    player: {
      ...EMPTY_BUILD,
      hp: 700,
      maxHp: 700,
      atk: 105,
      def: 35,
      spd: 38,
      evasionPct: 28,
      attackCount: 2,
      critChancePct: 18,
      skirmishNextTurnBonus: 1,
    },
  },
  {
    id: "bot:berserker",
    name: "투기장의 광전사",
    rating: 1600,
    player: {
      ...EMPTY_BUILD,
      hp: 1000,
      maxHp: 1000,
      atk: 130,
      def: 55,
      spd: 30,
      evasionPct: 12,
      attackCount: 2,
      berserkAtkPctPerLostHpPct: 1,
      thornsPct: 15,
    },
  },
  {
    id: "bot:assassin",
    name: "투기장의 암살자",
    rating: 1700,
    player: {
      ...EMPTY_BUILD,
      hp: 950,
      maxHp: 950,
      atk: 155,
      def: 60,
      spd: 50,
      evasionPct: 30,
      attackCount: 2,
      assassinateDmgMult: 2.5,
      critChancePct: 22,
      shadowCloneAtkPct: 50,
    },
  },
  {
    id: "bot:swordmaster",
    name: "투기장의 검호",
    rating: 1800,
    player: {
      ...EMPTY_BUILD,
      hp: 1300,
      maxHp: 1300,
      atk: 175,
      def: 85,
      spd: 55,
      evasionPct: 22,
      attackCount: 2,
      critChancePct: 25,
      riposteExtra: 2,
      fatedChainActive: true,
    },
  },
];

// 매칭과 동일한 단계: ±200 → ±500 → ±1000 → 전체. 봇 풀은 작지만 동일 정책으로 통일.
const RATING_RANGES: readonly number[] = [200, 500, 1000];

export function pickBotFor(myRating: number): BotEntry {
  for (const range of RATING_RANGES) {
    const inRange = BOTS.filter((b) => Math.abs(b.rating - myRating) <= range);
    if (inRange.length > 0) {
      return inRange[Math.floor(Math.random() * inRange.length)];
    }
  }
  // 어떤 단계에서도 없으면 전체에서 — BOTS 가 비지 않은 한 항상 hit.
  return BOTS[Math.floor(Math.random() * BOTS.length)];
}

export function isBotId(id: string): boolean {
  return id.startsWith("bot:");
}

// pvp_matches.defenderId 는 users.id FK 라 INSERT 시 users 에 row 가 있어야 한다.
// 봇 매치가 발생할 때만 lazy upsert — 봇 fallback 경로에서만 호출되므로 평소엔 무료.
// 이름 중복 (users_game_name_lower_idx) 이 터지면 그 봇만 skip (catch 해 무시) — 그 봇은
// 사용 불가능 상태가 되지만 다른 봇이 fallback 으로 다시 뽑힘.
export async function ensureBotUser(bot: BotEntry): Promise<void> {
  try {
    await db
      .insert(users)
      .values({
        id: bot.id,
        email: `${bot.id}@arena.local`,
        gameName: bot.name,
      })
      .onConflictDoNothing({ target: users.id });
  } catch (e) {
    // gameName lower unique 충돌 — 인간 유저가 같은 닉네임을 먼저 점유. 그 봇은 영구 사용 불가.
    console.warn(
      `[pvp/bots] ensureBotUser failed for ${bot.id} (likely gameName collision):`,
      e instanceof Error ? e.message : e,
    );
  }
}
