import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bulletinPosts } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  BULLETIN_FETCH_LIMIT,
  BULLETIN_MAX_LENGTH,
  BULLETIN_RATE_LIMIT_MS,
} from "@/lib/bulletin-config";

// GET /api/bulletin — 최근 N개 (오래된 → 최신 순으로 reverse).
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const rows = await db
    .select({
      id: bulletinPosts.id,
      name: bulletinPosts.name,
      className: bulletinPosts.className,
      title: bulletinPosts.title,
      content: bulletinPosts.content,
      createdAt: bulletinPosts.createdAt,
      mine: bulletinPosts.userId,
    })
    .from(bulletinPosts)
    .orderBy(desc(bulletinPosts.createdAt))
    .limit(BULLETIN_FETCH_LIMIT);

  const result = rows.map((r) => ({
    id: r.id,
    name: r.name,
    className: r.className,
    title: r.title,
    content: r.content,
    createdAt: r.createdAt.getTime(),
    mine: r.mine === userId,
  }));

  return Response.json(result);
}

// POST /api/bulletin — 글 작성.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: {
    name?: unknown;
    className?: unknown;
    title?: unknown;
    content?: unknown;
  };
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
  const content =
    typeof body.content === "string" ? body.content.trim() : "";

  if (!name) return new Response("missing name", { status: 400 });
  if (!className) return new Response("missing className", { status: 400 });
  if (!content) return new Response("empty content", { status: 400 });
  if (content.length > BULLETIN_MAX_LENGTH) {
    return new Response(`too long (max ${BULLETIN_MAX_LENGTH})`, {
      status: 400,
    });
  }

  // rate limit — 본인 마지막 글 시각 기준 X ms 이내면 차단.
  const since = new Date(Date.now() - BULLETIN_RATE_LIMIT_MS);
  const [lastRow] = await db
    .select({ createdAt: bulletinPosts.createdAt })
    .from(bulletinPosts)
    .where(eq(bulletinPosts.userId, userId))
    .orderBy(desc(bulletinPosts.createdAt))
    .limit(1);
  if (lastRow && lastRow.createdAt > since) {
    return new Response("rate limited", { status: 429 });
  }

  const [inserted] = await db
    .insert(bulletinPosts)
    .values({ userId, name, className, title, content })
    .returning({
      id: bulletinPosts.id,
      createdAt: bulletinPosts.createdAt,
    });

  return Response.json({
    id: inserted.id,
    name,
    className,
    title,
    content,
    createdAt: inserted.createdAt.getTime(),
    mine: true,
  });
}

// DELETE /api/bulletin?id=123 — 본인 글만 삭제 가능.
export async function DELETE(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const idStr = url.searchParams.get("id");
  const id = idStr ? Number(idStr) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  const result = await db
    .delete(bulletinPosts)
    .where(
      and(eq(bulletinPosts.id, id), eq(bulletinPosts.userId, userId)),
    )
    .returning({ id: bulletinPosts.id });

  if (result.length === 0) {
    return new Response("not found or not owner", { status: 404 });
  }

  return Response.json({ ok: true });
}
