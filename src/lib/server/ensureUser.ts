import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";

// API 라우트 진입 시 호출 — Clerk 인증 사용자를 DB users 테이블에 upsert 후
// userId 반환. 401 케이스는 호출 측에서 응답 분기.
//
// 단계별 실패는 console.error 로 진단 로그를 남긴다 — currentUser 가 실패해도
// email=null 로 진행 (필수 정보 아님). DB insert 실패는 throw → 호출 측이 500 처리.
export async function ensureUser(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  let email: string | null = null;
  try {
    const user = await currentUser();
    email = user?.emailAddresses[0]?.emailAddress ?? null;
  } catch (e) {
    const err = e as { name?: string; message?: string };
    console.warn("[ensureUser] currentUser() failed", {
      userId,
      name: err.name,
      message: err.message,
    });
    // email=null 로 계속 진행
  }

  try {
    await db
      .insert(users)
      .values({ id: userId, email })
      .onConflictDoNothing();
  } catch (e) {
    const err = e as { code?: string; name?: string; message?: string };
    console.error("[ensureUser] users insert failed", {
      userId,
      code: err.code,
      name: err.name,
      message: err.message,
    });
    throw e;
  }

  return userId;
}
