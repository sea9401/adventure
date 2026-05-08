import { gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { presence } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

const ONLINE_WINDOW_SECONDS = 60;

export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const since = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000);
  const rows = await db
    .select({
      userId: presence.userId,
      name: presence.name,
      className: presence.className,
      title: presence.title,
    })
    .from(presence)
    .where(gt(presence.lastSeenAt, since))
    .orderBy(presence.lastSeenAt);

  return Response.json(
    rows.map((r) => ({
      name: r.name,
      className: r.className,
      title: r.title,
      mine: r.userId === userId,
    })),
  );
}

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { name?: unknown; className?: unknown; title?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const className =
    typeof body.className === "string" ? body.className.trim() : "";
  const titleRaw = typeof body.title === "string" ? body.title.trim() : "";
  const title = titleRaw === "" ? null : titleRaw;

  if (!name) return new Response("missing name", { status: 400 });
  if (!className) return new Response("missing className", { status: 400 });

  await db
    .insert(presence)
    .values({ userId, name, className, title })
    .onConflictDoUpdate({
      target: presence.userId,
      set: { name, className, title, lastSeenAt: sql`now()` },
    });

  return new Response(null, { status: 204 });
}
