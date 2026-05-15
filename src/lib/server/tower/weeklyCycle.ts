// 주간 고탑 백분위 칭호 부여 — cron 이 호출하는 서버 사이드 batch.
//
// 지난 주(lastWeekStartKey) 의 tower-weekly.v1 기록 중 weekHighest >= MIN_FLOOR 인
// 유저들을 모아 computePercentileTitles 로 tier 배정 → adventure-log.v2 의 titles 에
// 추가. 한 유저당 한 행만 업데이트하므로 트랜잭션은 행별로(각자 독립).
//
// 이미 같은 칭호가 박혀있는 경우는 obtainedAt 을 덮어쓰지 않는다 (idempotent).

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { upsertSave } from "@/lib/server/savesKv";
import {
  TOWER_WEEKLY_STORAGE_KEY,
  TOWER_WEEKLY_MIN_FLOOR,
  lastWeekStartKey,
} from "@/adventure/tower/weeklyTypes";
import {
  WEEKLY_TIER_TITLE_IDS,
  computePercentileTitles,
  type WeeklyQualifier,
} from "@/adventure/tower/weeklyTiers";

type AdventureLogShape = {
  titles?: Record<string, { obtainedAt: number }>;
  [k: string]: unknown;
};

export type WeeklyCycleResult = {
  weekStart: string;
  qualifiers: number;
  awarded: number;
  /** tier 별 부여 횟수 (이미 보유분 포함, 즉 자격자 분포 = tier 분포). */
  byTier: Record<string, number>;
};

export async function runTowerWeeklyCycle(
  now: Date = new Date(),
): Promise<WeeklyCycleResult> {
  const weekStart = lastWeekStartKey(now);

  // 자격 통과 유저만 — 점수 desc, 동률 시 updated_at asc (먼저 도달한 사람이 위).
  const rows = await db.execute(sql`
    SELECT
      w.user_id,
      COALESCE((w.value->>'weekHighest')::int, 0) AS week_highest
    FROM saves_kv w
    WHERE w.key = ${TOWER_WEEKLY_STORAGE_KEY}
      AND w.value->>'weekStartedAt' = ${weekStart}
      AND COALESCE((w.value->>'weekHighest')::int, 0) >= ${TOWER_WEEKLY_MIN_FLOOR}
    ORDER BY week_highest DESC, w.updated_at ASC
  `);
  type DbRow = { user_id: string; week_highest: number };
  const qualifiers: WeeklyQualifier[] = (rows.rows as unknown as DbRow[]).map(
    (r) => ({ userId: String(r.user_id), weekHighest: Number(r.week_highest) }),
  );

  const tiers = computePercentileTitles(qualifiers);
  const byTier: Record<string, number> = {};
  for (const tier of tiers.values()) {
    byTier[tier] = (byTier[tier] ?? 0) + 1;
  }

  let awarded = 0;
  const obtainedAt = now.getTime();
  for (const [userId, tier] of tiers) {
    const titleId = WEEKLY_TIER_TITLE_IDS[tier];
    const granted = await grantTitleIfMissing(userId, titleId, obtainedAt);
    if (granted) awarded += 1;
  }

  return {
    weekStart,
    qualifiers: qualifiers.length,
    awarded,
    byTier,
  };
}

// adventure-log.v2 의 titles 에 한 항목 추가. 이미 있으면 no-op.
// 단일 트랜잭션 안에서 SELECT → MERGE → upsertSave 로 처리.
async function grantTitleIfMissing(
  userId: string,
  titleId: string,
  obtainedAt: number,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT value FROM saves_kv
      WHERE user_id = ${userId} AND key = 'adventure-log.v2'
      FOR UPDATE
    `);
    const row = result.rows[0] as { value: AdventureLogShape } | undefined;
    const current: AdventureLogShape = row?.value ?? {};
    const titles = current.titles ?? {};
    if (titles[titleId]) return false; // 이미 보유 — idempotent
    const next: AdventureLogShape = {
      ...current,
      titles: { ...titles, [titleId]: { obtainedAt } },
    };
    await upsertSave(tx, userId, "adventure-log.v2", next);
    return true;
  });
}
