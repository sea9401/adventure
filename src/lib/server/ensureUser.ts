import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

// API 라우트 진입 시 호출 — Auth.js 세션에서 userId 반환.
// 비인증 + stale JWT(=DB 와 어긋난 session.user.id) 둘 다 null 로 응답 → 호출 측은 401.
//
// JWT 전략이라 token.sub 는 AUTH_SECRET 서명만 맞으면 유효. DB 와의 정합성은 보장되지 않는다.
// 그래서 매 호출 ON CONFLICT (id) DO NOTHING 로 users 행을 보강한다.
// **target 을 id 로 명시** — email 충돌(23505) 은 suppress 하지 않고 surface 시켜야 한다.
//   - target 없는 onConflictDoNothing 은 email UNIQUE 충돌도 silent skip → users 행이 끝까지
//     안 생기고 saves_kv 등 FK 가 위반된다. (2026-05-16 Neon→RDS 컷오버 직후 stale JWT 들이
//     모두 이 경로로 떨어져 캐릭터 생성이 막혔던 사례 — AUTH_SECRET 로테이션으로 일단 unblock.)
//   - email 충돌은 "JWT 가 가리키는 user_id 가 DB 에 없는데, 같은 email 의 다른 user 행은 있다"
//     는 신호 = stale JWT. null 반환해서 호출 측에서 401 처리.
export async function ensureUser(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    await db
      .insert(users)
      .values({ id: session.user.id, email: session.user.email })
      .onConflictDoNothing({ target: users.id });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "23505") {
      console.warn("[ensureUser] stale JWT (email collision)", {
        sub: session.user.id,
        email: session.user.email,
      });
      return null;
    }
    throw e;
  }

  return session.user.id;
}
