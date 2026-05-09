import { sql } from "drizzle-orm";
import type { db } from "@/db";
import { savesKv } from "@/db/schema";

// savesKv 행을 업서트할 때 version + updatedAt 을 같이 갱신하는 헬퍼.
// 클라이언트 PATCH 가 낙관적 동시성으로 expectedVersion 검사를 하기 때문에
// 서버 사이드 쓰기 (마켓 정산 / 인박스 claim / 어드민 등) 도 모두 version 을 올려줘야
// 클라이언트가 다음 patch 때 stale 충돌을 감지할 수 있다.
//
// `executor` 는 최상위 `db` 또는 `db.transaction` 콜백 인자 (`tx`) 양쪽을 받을 수 있도록
// 타입을 느슨하게 가져감.
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function upsertSave(
  executor: DbExecutor,
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const now = new Date();
  await executor
    .insert(savesKv)
    .values({ userId, key, value, version: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: [savesKv.userId, savesKv.key],
      set: {
        value,
        version: sql`${savesKv.version} + 1`,
        updatedAt: now,
      },
    });
}
