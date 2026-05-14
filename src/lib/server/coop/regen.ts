// 월드 보스 lazy regen — coop_boss_sessions.regen_per_min > 0 인 세션에 대해
// GET / attack 진입 시 atomic 으로 hp 를 회복시킨다.
//
// 회복 계산은 PostgreSQL 측 interval 산술로 처리해 race 가 없는 단일 UPDATE 로
// 끝낸다. 다인 동시 GET/attack 이 들어와도 같은 row 의 UPDATE 는 직렬화되므로
// last_regen_at 이 한 번에 한 step 씩만 전진 (이중 회복 방지).
//
// 회복 조건:
//   - regen_per_min > 0
//   - defeated_at IS NULL (활성)
//   - hp > 0, hp < max_hp
//   - last_regen_at IS NOT NULL AND now - last_regen_at >= 1분 (분 단위 step)
//
// 적용량:
//   heal = floor((now - last_regen_at) / 1min) × regen_per_min
//   new_hp = LEAST(max_hp, hp + heal)
//   new_last = last_regen_at + floor((now - last_regen_at) / 1min) × 1min
// (last 를 now 로 박지 않고 elapsed_min 만큼만 전진 — 0.x 분 fractional 누적 보존.)

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { coopBossSessions } from "@/db/schema";
import type { PgTransaction } from "drizzle-orm/pg-core";

type DbOrTx = typeof db | PgTransaction<never, never, never>;

/**
 * 단일 세션에 lazy regen 을 적용한다. regen 대상 아닌 세션은 no-op.
 * 호출 후 별도로 SELECT 해서 최신 hp 를 읽어야 한다 (이 함수는 update 만).
 */
export async function applyLazyRegen(
  sessionId: string,
  exec: DbOrTx = db,
): Promise<void> {
  // PG 측에서 모든 계산 — 1 statement, atomic.
  // EPOCH 차이를 60으로 나눈 floor 분으로 elapsed_min 을 구하고, 그 분만큼 hp 와
  // last_regen_at 을 동시에 전진. WHERE 절이 조건 다 만족할 때만 실제 update 가 일어남.
  await exec.execute(sql`
    UPDATE ${coopBossSessions}
    SET
      hp = LEAST(
        ${coopBossSessions.maxHp},
        ${coopBossSessions.hp}
          + FLOOR(EXTRACT(EPOCH FROM (NOW() - ${coopBossSessions.lastRegenAt})) / 60)::integer
          * ${coopBossSessions.regenPerMin}
      ),
      last_regen_at = ${coopBossSessions.lastRegenAt}
        + (FLOOR(EXTRACT(EPOCH FROM (NOW() - ${coopBossSessions.lastRegenAt})) / 60)::integer
          * INTERVAL '1 minute')
    WHERE ${coopBossSessions.id} = ${sessionId}
      AND ${coopBossSessions.regenPerMin} > 0
      AND ${coopBossSessions.defeatedAt} IS NULL
      AND ${coopBossSessions.hp} > 0
      AND ${coopBossSessions.hp} < ${coopBossSessions.maxHp}
      AND ${coopBossSessions.lastRegenAt} IS NOT NULL
      AND EXTRACT(EPOCH FROM (NOW() - ${coopBossSessions.lastRegenAt})) >= 60
  `);
}
