import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  savesKv,
  marketplaceListings,
  marketplaceInbox,
} from "@/db/schema";

// Clerk dev → production 인스턴스 전환 후, 같은 이메일로 재가입한 사용자의 옛 데이터를
// 새 userId 로 자동 이관. ensureUser 에서 새 userId 가 INSERT 된 직후 호출.
//
// 절차:
//   1) email 로 다른 userId 의 row 검색 (대소문자 무시, 가장 최근 가입한 한 건)
//   2) 새 userId 가 이미 데이터 가졌으면 skip (재실행 안전)
//   3) savesKv / marketplaceListings (seller+buyer) / marketplaceInbox 의 user FK 갱신
//   4) 옛 users row 삭제 (CASCADE 로 presence/messages 정리)
//
// 단계별 UPDATE 는 WHERE userId=oldId 로 idempotent — 부분 실패 시 재시도 안전.
// 트랜잭션은 neon-http 미지원이지만 단방향 마이그레이션이라 race 도 안전.
export async function migrateUserIfNeeded(
  newUserId: string,
  email: string | null,
): Promise<{ migrated: boolean; oldUserId?: string }> {
  if (!email) return { migrated: false };

  // 같은 이메일의 다른 userId 찾기 (가장 최근 가입한 한 건)
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(
      sql`lower(${users.email}) = lower(${email}) and ${users.id} <> ${newUserId}`,
    )
    .orderBy(sql`${users.createdAt} desc`)
    .limit(1);

  if (candidates.length === 0) return { migrated: false };
  const oldUserId = candidates[0].id;

  // 새 userId 에 이미 데이터 있으면 스킵 (예: 사용자가 신규로 게임을 진행했는데
  // 뒤늦게 같은 이메일이 발견된 케이스 — 덮어쓰지 않음)
  const existing = await db
    .select({ key: savesKv.key })
    .from(savesKv)
    .where(eq(savesKv.userId, newUserId))
    .limit(1);
  if (existing.length > 0) {
    console.warn("[migrateUser] newUserId already has data, skipping", {
      oldUserId,
      newUserId,
    });
    return { migrated: false };
  }

  // 단계별 마이그레이션 — 각 UPDATE 는 idempotent.
  await db
    .update(savesKv)
    .set({ userId: newUserId })
    .where(eq(savesKv.userId, oldUserId));

  await db
    .update(marketplaceListings)
    .set({ sellerId: newUserId })
    .where(eq(marketplaceListings.sellerId, oldUserId));

  await db
    .update(marketplaceListings)
    .set({ buyerId: newUserId })
    .where(eq(marketplaceListings.buyerId, oldUserId));

  await db
    .update(marketplaceInbox)
    .set({ userId: newUserId })
    .where(eq(marketplaceInbox.userId, oldUserId));

  // 옛 users row 삭제 — CASCADE 로 messages/presence 도 함께 제거 (휘발성, 보존 불필요)
  await db.delete(users).where(eq(users.id, oldUserId));

  console.log("[migrateUser] migrated", { oldUserId, newUserId, email });
  return { migrated: true, oldUserId };
}
