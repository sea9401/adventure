import { currentUser } from "@clerk/nextjs/server";

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
