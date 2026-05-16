import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bulletinComments, bulletinLikes, bulletinPosts } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { resolveActor } from "@/lib/server/resolveActor";
import { isCurrentUserAdmin } from "@/lib/server/isAdmin";
import {
  BULLETIN_FETCH_LIMIT,
  BULLETIN_MAX_LENGTH,
  BULLETIN_RATE_LIMIT_MS,
  BULLETIN_TITLE_MAX_LENGTH,
  isBulletinCategory,
  USER_WRITABLE_CATEGORIES,
  type BulletinCategory,
} from "@/lib/bulletin-config";

// GET /api/bulletin?category=<cat>&q=<search>
//   category 미지정 — 전체 (탭 "전체" 용도, 클라가 안 쓰면 그대로 둠)
//   q — title/content 부분일치(ILIKE %q%). 짧은 입력은 클라에서 막아도 됨.
// 응답 — like/comment 카운트와 likedByMe 를 서브쿼리로 동봉 (N+1 회피).
export async function GET(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const categoryParam = url.searchParams.get("category");
  const q = (url.searchParams.get("q") ?? "").trim();

  const filters: SQL[] = [];
  if (categoryParam && isBulletinCategory(categoryParam)) {
    filters.push(eq(bulletinPosts.category, categoryParam));
  }
  if (q) {
    // PG `ILIKE` 는 대소문자 무시. % 와 _ 는 사용자 입력 그대로 패턴 메타가 되므로
    // 안전을 위해 이스케이프해 리터럴 매칭으로 강제 — drizzle 의 ilike 도 결국 raw 패턴이라
    // 이 처리가 없으면 '%' 입력이 와일드카드처럼 동작한다.
    const escaped = q.replace(/[\\%_]/g, (m) => "\\" + m);
    const pattern = `%${escaped}%`;
    const titleMatch = ilike(bulletinPosts.title, pattern);
    const contentMatch = ilike(bulletinPosts.content, pattern);
    const combined = or(titleMatch, contentMatch);
    if (combined) filters.push(combined);
  }

  const where =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : and(...filters);

  // 서브쿼리 — 글마다 likes/comments 카운트와 본인 좋아요 여부. drizzle 의 sql 템플릿으로 표현.
  // sql<number>`COUNT(*)::int` — PG 가 bigint 으로 돌려주는 걸 int 로 캐스팅해 JS Number 로 받음.
  const rows = await db
    .select({
      id: bulletinPosts.id,
      name: bulletinPosts.name,
      className: bulletinPosts.className,
      category: bulletinPosts.category,
      title: bulletinPosts.title,
      content: bulletinPosts.content,
      createdAt: bulletinPosts.createdAt,
      mine: bulletinPosts.userId,
      likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${bulletinLikes} WHERE ${bulletinLikes.postId} = ${bulletinPosts.id})`,
      commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${bulletinComments} WHERE ${bulletinComments.postId} = ${bulletinPosts.id})`,
      likedByMe: sql<boolean>`EXISTS(SELECT 1 FROM ${bulletinLikes} WHERE ${bulletinLikes.postId} = ${bulletinPosts.id} AND ${bulletinLikes.userId} = ${userId})`,
    })
    .from(bulletinPosts)
    .where(where)
    .orderBy(desc(bulletinPosts.createdAt))
    .limit(BULLETIN_FETCH_LIMIT);

  const result = rows.map((r) => ({
    id: r.id,
    name: r.name,
    className: r.className,
    category: r.category as BulletinCategory,
    title: r.title,
    content: r.content,
    createdAt: r.createdAt.getTime(),
    mine: r.mine === userId,
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    likedByMe: r.likedByMe,
  }));

  return Response.json(result);
}

// POST /api/bulletin — 글 작성. body: { category, title?, content }
// notice 카테고리는 admin 만 가능 (403). 그 외 카테고리는 USER_WRITABLE_CATEGORIES 검증.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { category?: unknown; title?: unknown; content?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!isBulletinCategory(body.category)) {
    return new Response("invalid category", { status: 400 });
  }
  const category: BulletinCategory = body.category;

  if (category === "notice") {
    const admin = await isCurrentUserAdmin();
    if (!admin) return new Response("forbidden", { status: 403 });
  } else if (!USER_WRITABLE_CATEGORIES.includes(category)) {
    // 방어 — 만약 notice/free/guide 외 신규 카테고리가 추가되고 USER_WRITABLE_CATEGORIES
    // 에 안 들어가 있으면 admin only 정책으로 기본 보수적 처리.
    const admin = await isCurrentUserAdmin();
    if (!admin) return new Response("forbidden", { status: 403 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return new Response("empty content", { status: 400 });
  if (content.length > BULLETIN_MAX_LENGTH) {
    return new Response(`too long (max ${BULLETIN_MAX_LENGTH})`, {
      status: 400,
    });
  }

  // title — body 에서 받아도 되고 (제목 입력란), 없으면 actor.title (칭호) 로 fallback.
  // 빈 문자열은 null 로 정규화.
  const rawTitle =
    typeof body.title === "string" ? body.title.trim() : null;
  if (rawTitle && rawTitle.length > BULLETIN_TITLE_MAX_LENGTH) {
    return new Response(`title too long (max ${BULLETIN_TITLE_MAX_LENGTH})`, {
      status: 400,
    });
  }
  const titleFromBody = rawTitle || null;

  const { name, className, title: actorTitle } = await resolveActor(userId);
  const title = titleFromBody ?? actorTitle;

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
    .values({ userId, name, className, category, title, content })
    .returning({
      id: bulletinPosts.id,
      createdAt: bulletinPosts.createdAt,
    });

  return Response.json({
    id: inserted.id,
    name,
    className,
    category,
    title,
    content,
    createdAt: inserted.createdAt.getTime(),
    mine: true,
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
  });
}

// DELETE /api/bulletin?id=123 — 본인 글 + admin 은 모든 글 삭제 가능.
export async function DELETE(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const idStr = url.searchParams.get("id");
  const id = idStr ? Number(idStr) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  const admin = await isCurrentUserAdmin();
  const where = admin
    ? eq(bulletinPosts.id, id)
    : and(eq(bulletinPosts.id, id), eq(bulletinPosts.userId, userId));

  const result = await db
    .delete(bulletinPosts)
    .where(where)
    .returning({ id: bulletinPosts.id });

  if (result.length === 0) {
    return new Response("not found or not owner", { status: 404 });
  }

  return Response.json({ ok: true });
}
