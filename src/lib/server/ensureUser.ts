import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";

// API 라우트 진입 시 호출 — Clerk 인증 사용자를 DB users 테이블에 upsert 후
// userId 반환. 401 케이스는 호출 측에서 응답 분기.
export async function ensureUser(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // 이메일은 첫 부트스트랩에서만 캐싱 (이후 변경은 무시 — 굳이 동기화할 필요 없음).
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? null;

  await db
    .insert(users)
    .values({ id: userId, email })
    .onConflictDoNothing();

  return userId;
}
