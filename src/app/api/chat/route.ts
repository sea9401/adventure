import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  CHAT_FETCH_LIMIT,
  CHAT_MAX_LENGTH,
  CHAT_RATE_LIMIT_MS,
} from "@/lib/chat-config";

export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const rows = await db
    .select({
      id: messages.id,
      name: messages.name,
      className: messages.className,
      title: messages.title,
      content: messages.content,
      createdAt: messages.createdAt,
      mine: messages.userId,
    })
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(CHAT_FETCH_LIMIT);

  const result = rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      className: r.className,
      title: r.title,
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
  if (content.length > CHAT_MAX_LENGTH) {
    return new Response(`too long (max ${CHAT_MAX_LENGTH})`, { status: 400 });
  }

  const since = new Date(Date.now() - CHAT_RATE_LIMIT_MS);
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
    .values({ userId, name, className, title, content })
    .returning({
      id: messages.id,
      createdAt: messages.createdAt,
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
