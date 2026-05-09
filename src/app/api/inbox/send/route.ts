import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceInbox, users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  USER_MESSAGE_DAILY_CAP,
  USER_MESSAGE_MAX_LENGTH,
  USER_MESSAGE_RATE_LIMIT_MS,
} from "@/lib/inbox-config";

// POST /api/inbox/send — 유저 간 쪽지 1통 발송.
//   body: { recipientName: string, text: string }
// 검증: 본인 차단, 길이, rate limit (마지막 발송 + 24h 누적), 수신자 존재.
export async function POST(req: Request) {
  const senderId = await ensureUser();
  if (!senderId) return new Response("unauthorized", { status: 401 });

  let body: { recipientName?: unknown; text?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const recipientNameRaw =
    typeof body.recipientName === "string" ? body.recipientName.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!recipientNameRaw) return new Response("missing recipient", { status: 400 });
  if (!text) return new Response("empty text", { status: 400 });
  if (text.length > USER_MESSAGE_MAX_LENGTH) {
    return new Response(`too long (max ${USER_MESSAGE_MAX_LENGTH})`, {
      status: 400,
    });
  }

  // 발신자 닉네임 조회 — 이름이 아직 설정 안 된 유저(name=NULL) 는 발송 차단.
  const [sender] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, senderId))
    .limit(1);
  if (!sender || !sender.name) {
    return new Response("sender_no_name", { status: 400 });
  }

  // 수신자 lookup (대소문자 무시 — users_name_lower_idx).
  const [recipient] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(sql`lower(${users.name}) = lower(${recipientNameRaw})`)
    .limit(1);
  if (!recipient) {
    return new Response("recipient_not_found", { status: 404 });
  }
  if (recipient.id === senderId) {
    return new Response("self_send", { status: 400 });
  }

  // rate limit — 마지막 발송 시각 + 24h 누적.
  const since = new Date(Date.now() - USER_MESSAGE_RATE_LIMIT_MS);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [last] = await db
    .select({ createdAt: marketplaceInbox.createdAt })
    .from(marketplaceInbox)
    .where(
      and(
        eq(marketplaceInbox.fromUserId, senderId),
        eq(marketplaceInbox.kind, "user_message"),
      ),
    )
    .orderBy(desc(marketplaceInbox.createdAt))
    .limit(1);
  if (last && last.createdAt > since) {
    return new Response("rate limited", { status: 429 });
  }

  const [{ value: dailyCount }] = await db
    .select({ value: count() })
    .from(marketplaceInbox)
    .where(
      and(
        eq(marketplaceInbox.fromUserId, senderId),
        eq(marketplaceInbox.kind, "user_message"),
        gt(marketplaceInbox.createdAt, dayAgo),
      ),
    );
  if (dailyCount >= USER_MESSAGE_DAILY_CAP) {
    return new Response("daily_cap", { status: 429 });
  }

  await db.insert(marketplaceInbox).values({
    userId: recipient.id,
    kind: "user_message",
    payload: { text },
    fromUserId: senderId,
    fromName: sender.name,
  });

  return Response.json({ ok: true, recipientName: recipient.name });
}
