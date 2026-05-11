import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

// API 라우트 진입 시 호출 — Auth.js 세션에서 userId 반환.
// Auth.js DrizzleAdapter 가 로그인 시 users 행을 자동 생성/갱신하므로
// 별도 upsert 없이 session.user.id 를 그대로 사용.
// 비인증 상태면 null 반환 — 호출 측에서 401 처리.
export async function ensureUser(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // 아직 DB 행이 없는 경우(첫 로그인 직후 어댑터 경쟁 조건) 안전하게 보강.
  await db.insert(users).values({ id: session.user.id, email: session.user.email }).onConflictDoNothing();

  return session.user.id;
}
