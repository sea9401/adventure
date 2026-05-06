import { kv } from "@vercel/kv";

// 일별 통계는 90일 유지, 글로벌 누적은 영구.
const DAY_TTL = 90 * 24 * 60 * 60;

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

const hasKv = () => !!process.env.KV_REST_API_URL;

const safe = async <T>(p: Promise<T>): Promise<T | undefined> => {
  try {
    return await p;
  } catch {
    return undefined;
  }
};

/** 활동 닉네임 기록 (DAU 카운팅). 모든 API 호출 시 호출 권장. */
export async function addActive(nickname: string): Promise<void> {
  if (!hasKv() || !nickname) return;
  const key = `stats:day:${todayUtc()}:active`;
  await safe(kv.sadd(key, nickname));
  await safe(kv.expire(key, DAY_TTL));
}

/** 신규 닉네임 등록 시 호출. 첫 등록만 카운트. */
export async function addNewPlayer(nickname: string): Promise<void> {
  if (!hasKv() || !nickname) return;
  const r = await safe(kv.sadd("stats:players:all", nickname));
  if (r === 1) {
    const dayKey = `stats:day:${todayUtc()}:new`;
    await safe(kv.incr(dayKey));
    await safe(kv.expire(dayKey, DAY_TTL));
    await safe(kv.incr("stats:global:totalPlayers"));
  }
}

/** 보스 처치 카운트. */
export async function addBossKill(bossName: string): Promise<void> {
  if (!hasKv() || !bossName) return;
  const dayKey = `stats:day:${todayUtc()}:bossKills`;
  await safe(kv.hincrby(dayKey, bossName, 1));
  await safe(kv.expire(dayKey, DAY_TTL));
  await safe(kv.hincrby("stats:global:bossKills", bossName, 1));
}

/** 닉네임 → 클래스 매핑 갱신 (직업 분포 분석용) */
export async function setClass(nickname: string, className: string): Promise<void> {
  if (!hasKv() || !nickname || !className) return;
  await safe(kv.hset("stats:classes", { [nickname]: className }));
}

/** 글로벌 통계 스냅샷 (캐시 호출용 raw fetch) */
export type GlobalStats = {
  totalPlayers: number;
  dau: number; // 오늘 활동 닉네임 수
  newToday: number; // 오늘 신규 등록
  topBossKills: { boss: string; count: number }[];
};

export async function readGlobalStats(): Promise<GlobalStats> {
  if (!hasKv()) {
    return { totalPlayers: 0, dau: 0, newToday: 0, topBossKills: [] };
  }
  const day = todayUtc();
  const [totalPlayers, dau, newToday, bossKills] = await Promise.all([
    safe(kv.get<number>("stats:global:totalPlayers")),
    safe(kv.scard(`stats:day:${day}:active`)),
    safe(kv.get<number>(`stats:day:${day}:new`)),
    safe(kv.hgetall<Record<string, number>>("stats:global:bossKills")),
  ]);
  const top = Object.entries(bossKills ?? {})
    .map(([boss, count]) => ({ boss, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    totalPlayers: totalPlayers ?? 0,
    dau: dau ?? 0,
    newToday: newToday ?? 0,
    topBossKills: top,
  };
}

export type TimeseriesMetric = "dau" | "new_players" | "boss_kills";
export type TimeseriesPoint = { day: string; value: number };

const dayString = (d: Date): string => d.toISOString().slice(0, 10);

/** 지정 metric을 N일치 일별 시계열로 반환 (오래된 → 오늘 순). */
export async function readTimeseries(
  metric: TimeseriesMetric,
  days: number,
): Promise<TimeseriesPoint[]> {
  if (!hasKv()) return [];
  const today = new Date();
  const cap = Math.max(1, Math.min(90, days));
  const result: TimeseriesPoint[] = [];
  for (let i = cap - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const day = dayString(d);
    let value = 0;
    if (metric === "dau") {
      value = (await safe(kv.scard(`stats:day:${day}:active`))) ?? 0;
    } else if (metric === "new_players") {
      value = (await safe(kv.get<number>(`stats:day:${day}:new`))) ?? 0;
    } else if (metric === "boss_kills") {
      const map = await safe(kv.hgetall<Record<string, number>>(`stats:day:${day}:bossKills`));
      value = Object.values(map ?? {}).reduce((s, v) => s + Number(v), 0);
    }
    result.push({ day, value });
  }
  return result;
}
