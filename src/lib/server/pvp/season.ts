// PvP 주간 시즌 — 월요일 00:00 KST (= UTC 일요일 15:00) 부터 다음 월요일 직전까지.
// id 형식: "YYYY-Www" (ISO 주차). 시즌 cron 이 주간 롤오버 시 신규 시즌 생성 + 이전 시즌 closed 마킹.
//
// 현재 활성 시즌이 없으면 lazy 로 생성 (cron 미동작 환경 / 첫 PvP 호출 보호).
// 매칭/도전 API 에서 매 호출 getCurrentSeason() 진입 — 보통 단 한 row read.

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { pvpSeasons } from "@/db/schema";

// "월 00:00 KST" = "일 15:00 UTC". 입력 시각 기준 이번 주의 월요일 KST 자정 (UTC).
export function weekStartUtcFor(now: Date): Date {
  // KST 자정 = UTC -09:00. UTC 시간 기준으로 "전 일요일 15:00" 을 찾음.
  // getUTCDay: 일=0, 월=1, ..., 토=6.
  const d = new Date(now.getTime());
  d.setUTCHours(15, 0, 0, 0);
  // 만약 d 가 now 보다 미래면 (예: now=토 16:00 UTC → d=토 15:00 은 과거), 한 주 전 일요일로.
  // 일반 케이스: now 의 UTC 요일 기준으로 직전 일요일 15:00 을 향해 후진.
  const daysSinceSunday = d.getUTCDay(); // 0 일~6 토
  // 일요일 15:00 부터 다음 일요일 14:59 까지가 한 주.
  if (daysSinceSunday === 0) {
    // 일요일 — 15:00 이전이면 한 주 전 일요일, 이후면 오늘.
    if (now.getTime() < d.getTime()) {
      d.setUTCDate(d.getUTCDate() - 7);
    }
  } else {
    // 월~토 — 직전 일요일로 후진.
    d.setUTCDate(d.getUTCDate() - daysSinceSunday);
  }
  return d;
}

export function weekEndUtcFor(weekStart: Date): Date {
  const end = new Date(weekStart.getTime());
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

// id 형식: "YYYY-Www". 시즌 시작 KST 의 ISO 주차 키.
// 예: 2026-05-18 (월) KST 시작 시즌 → "2026-W21".
export function seasonIdFor(weekStartUtc: Date): string {
  // ISO 주차는 목요일 기준 — 시즌 시작이 월(KST)=일(UTC15:00) 이라 목요일까지 +4일.
  const thursday = new Date(weekStartUtc.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + 4);
  const year = thursday.getUTCFullYear();
  // ISO 주차 계산: 그 해 1월 4일 (= 1주차에 항상 포함되는 날) 의 목요일 기준 차이.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 0(일) → 7
  const jan4Thursday = new Date(jan4.getTime());
  jan4Thursday.setUTCDate(jan4.getUTCDate() + (4 - jan4Day));
  const diffDays = Math.round(
    (thursday.getTime() - jan4Thursday.getTime()) / (24 * 60 * 60 * 1000),
  );
  const weekNo = 1 + Math.floor(diffDays / 7);
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

// 현재 시각 기준 활성 시즌 1건. 없으면 생성. ON CONFLICT 으로 race 안전.
export async function getOrCreateCurrentSeason(now: Date = new Date()) {
  const weekStart = weekStartUtcFor(now);
  const weekEnd = weekEndUtcFor(weekStart);
  const id = seasonIdFor(weekStart);

  const existing = await db
    .select()
    .from(pvpSeasons)
    .where(eq(pvpSeasons.id, id))
    .limit(1);
  if (existing[0]) return existing[0];

  // 신규 시즌 INSERT — race 발생 시 PK 충돌. ON CONFLICT 으로 두 번째 호출은 그냥 읽어옴.
  const inserted = await db
    .insert(pvpSeasons)
    .values({
      id,
      startAt: weekStart,
      endAt: weekEnd,
      status: "active",
    })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  // race — 다른 요청이 먼저 insert. 다시 select.
  const refetch = await db
    .select()
    .from(pvpSeasons)
    .where(eq(pvpSeasons.id, id))
    .limit(1);
  if (!refetch[0]) throw new Error(`pvp season ${id} not found after race`);
  return refetch[0];
}

// 시즌 종료 (cron 용) — 현재 시각이 endAt 지났고 아직 active 인 시즌을 closed 로 마킹.
// 보상 지급은 별도 단계 (rewardsGrantedAt 사용).
export async function closeExpiredSeasons(
  now: Date = new Date(),
): Promise<number> {
  const result = await db
    .update(pvpSeasons)
    .set({ status: "closed", closedAt: now })
    .where(
      and(
        eq(pvpSeasons.status, "active"),
        lte(pvpSeasons.endAt, now),
      ),
    )
    .returning({ id: pvpSeasons.id });
  return result.length;
}

// 시간대 안의 모든 시즌 (히스토리 조회용). 보통 직전 N개.
export async function listSeasons(opts: { limit?: number; since?: Date } = {}) {
  const { limit = 10, since } = opts;
  const where = since ? gte(pvpSeasons.startAt, since) : undefined;
  return db
    .select()
    .from(pvpSeasons)
    .where(where)
    .orderBy(pvpSeasons.startAt)
    .limit(limit);
}
