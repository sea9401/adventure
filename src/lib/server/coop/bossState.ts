// 협동 토벌 보스 — 서버측 공용 헬퍼.
//
// /api/coop/[region] route 와 attack/claim lib 가 공유: 처치 broadcast(광장 게시판 1줄
// 시스템 글) + storyFlag 서버 set(savesKv 의 storyFlags.v2 갱신).

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { coopBossContributors, messages, savesKv, users } from "@/db/schema";
import { upsertSave } from "@/lib/server/savesKv";
import { STORY_FLAGS_STORAGE_KEY } from "@/adventure/storyFlags/storage";

// 처치 broadcast — 채팅에 1줄 시스템 글.
export async function broadcastBossKill(
  killerId: string,
  sessionId: string,
  bossName: string,
): Promise<void> {
  const contribs = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coopBossContributors)
    .where(eq(coopBossContributors.sessionId, sessionId));
  const count = Number(contribs[0]?.count ?? 0);

  const killer = await db
    .select({ name: users.gameName })
    .from(users)
    .where(eq(users.id, killerId))
    .limit(1);
  let killerName = killer[0]?.name ?? null;
  if (!killerName) {
    const [profRow] = await db
      .select({ value: savesKv.value })
      .from(savesKv)
      .where(
        and(
          eq(savesKv.userId, killerId),
          eq(savesKv.key, "character-profile.v2"),
        ),
      )
      .limit(1);
    const n = (profRow?.value as { name?: unknown } | null)?.name;
    if (typeof n === "string" && n.trim()) killerName = n.trim();
  }
  if (!killerName) killerName = "이름 없는 모험가";

  await db.insert(messages).values({
    userId: killerId,
    name: killerName,
    className: "협동 토벌",
    title: null,
    content: `${bossName}이(가) 쓰러졌다 — 마지막 일격: ${killerName} · 기여자 ${count}명`,
  });
}

// storyFlag 서버 set — savesKv 의 storyFlags.v2 row 갱신.
// 클라이언트가 다음 reload 에서 useSavedValue 로 가져가 반영.
export async function setStoryFlagServer(
  userId: string,
  flagId: string,
): Promise<void> {
  // 클라/서버 공용 상수 — 리터럴 재기재 금지 (불일치 시 서버가 박은 플래그가
  // 클라에 영원히 안 보임 — 운봉의 거인 후 운향 진입로 안 열리던 버그 이력).
  const STORAGE_KEY = STORY_FLAGS_STORAGE_KEY;
  // 행을 FOR UPDATE 로 잠그고 읽기 → 합치기 → 쓰기, 전부 단일 트랜잭션.
  // (route 가 이 함수를 onDefeatFlag/onAttackFlag 로 2회 연속 호출하고, 클라의
  //  useRemotePatch("storyFlags.v2") PATCH 도 동시에 in-flight 일 수 있다 — 락 없는
  //  read-modify-write 는 lost update 로 플래그가 조용히 안 박혀 진행 게이트가 안 열린다.)
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ value: savesKv.value })
      .from(savesKv)
      .where(and(eq(savesKv.userId, userId), eq(savesKv.key, STORAGE_KEY)))
      .for("update")
      .limit(1);
    const value = existing[0]?.value as { flags?: unknown } | undefined;
    const flags: string[] = Array.isArray(value?.flags)
      ? (value.flags as unknown[]).filter(
          (f): f is string => typeof f === "string",
        )
      : [];
    if (flags.includes(flagId)) return;
    flags.push(flagId);
    await upsertSave(tx, userId, STORAGE_KEY, { flags });
  });
}
