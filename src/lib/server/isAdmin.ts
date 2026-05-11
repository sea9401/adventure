import { auth } from "@/auth";

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
  const session = await auth();
  if (!session?.user?.email) return false;
  return allow.has(session.user.email.toLowerCase());
}

export async function requireAdmin(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });
  const ok = await isCurrentUserAdmin();
  if (!ok) return new Response("forbidden", { status: 403 });
  return null;
}
