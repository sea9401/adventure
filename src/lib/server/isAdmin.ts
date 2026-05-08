import { auth, currentUser } from "@clerk/nextjs/server";

// ADMIN_EMAILS 는 콤마 구분. 비어있으면 admin 없음(전부 거부).
function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const allow = getAdminEmails();
  if (allow.size === 0) return false;
  const user = await currentUser();
  if (!user) return false;
  for (const e of user.emailAddresses) {
    if (allow.has(e.emailAddress.toLowerCase())) return true;
  }
  return false;
}

// API 라우트용 가드. 비로그인 → 401, 로그인했지만 admin 아님 → 403.
// 통과 시 null, 차단 시 응답을 반환 — 호출 측은 `if (gate) return gate;` 패턴.
export async function requireAdmin(): Promise<Response | null> {
  const { userId } = await auth();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const ok = await isCurrentUserAdmin();
  if (!ok) return new Response("forbidden", { status: 403 });
  return null;
}
