import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

const MAX_LENGTH = 200;
const FETCH_LIMIT = 50;
const RATE_LIMIT_MS = 2000;

export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const rows = await db
    .select({
      id: messages.id,
      name: messages.name,
      level: messages.level,
      content: messages.content,
      createdAt: messages.createdAt,
      mine: messages.userId,
    })
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(FETCH_LIMIT);

  const result = rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level,
      content: r.content,
      createdAt: r.createdAt.getTime(),
      mine: r.mine === userId,
    }))
    .reverse();

  return Response.json(result);
}

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { name?: unknown; level?: unknown; content?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const level =
    typeof body.level === "number" && Number.isFinite(body.level)
      ? Math.max(1, Math.floor(body.level))
      : null;
  const content =
    typeof body.content === "string" ? body.content.trim() : "";

  if (!name) return new Response("missing name", { status: 400 });
  if (level === null) return new Response("missing level", { status: 400 });
  if (!content) return new Response("empty content", { status: 400 });
  if (content.length > MAX_LENGTH) {
    return new Response(`too long (max ${MAX_LENGTH})`, { status: 400 });
  }

  const since = new Date(Date.now() - RATE_LIMIT_MS);
  const [lastRow] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.userId, userId))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (lastRow && lastRow.createdAt > since) {
    return new Response("rate limited", { status: 429 });
  }

  const [inserted] = await db
    .insert(messages)
    .values({ userId, name, level, content })
    .returning({
      id: messages.id,
      createdAt: messages.createdAt,
    });

  return Response.json({
    id: inserted.id,
    name,
    level,
    content,
    createdAt: inserted.createdAt.getTime(),
    mine: true,
  });
}
