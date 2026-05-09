import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceInbox, savesKv, users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { PROFILE_STORAGE_KEY } from "@/lib/storage-keys";
import {
  USER_MESSAGE_DAILY_CAP,
  USER_MESSAGE_MAX_LENGTH,
  USER_MESSAGE_RATE_LIMIT_MS,
} from "@/lib/inbox-config";

type SenderProbe = {
  usersRowExists: boolean;
  usersNamePresent: boolean;
  profileRowExists: boolean;
  profileNamePresent: boolean;
  profileShape: string[] | null;
};

// 닉네임은 dual-source — `users.name` (신규 유저, authoritative) 와
// `savesKv[character-profile.v2].name` (레거시 유저). 한쪽이라도 있으면 사용.
async function resolveSenderName(
  userId: string,
): Promise<{ name: string | null; probe: SenderProbe }> {
  const [u] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [profile] = await db
    .select({ value: savesKv.value })
    .from(savesKv)
    .where(
      and(eq(savesKv.userId, userId), eq(savesKv.key, PROFILE_STORAGE_KEY)),
    )
    .limit(1);
  const legacyName = (profile?.value as { name?: unknown } | undefined)?.name;

  const probe: SenderProbe = {
    usersRowExists: !!u,
    usersNamePresent: typeof u?.name === "string" && u.name.length > 0,
    profileRowExists: !!profile,
    profileNamePresent:
      typeof legacyName === "string" && legacyName.length > 0,
    profileShape: profile
      ? Object.keys((profile.value as Record<string, unknown>) ?? {})
      : null,
  };

  if (u?.name) return { name: u.name, probe };
  if (typeof legacyName === "string" && legacyName.length > 0) {
    return { name: legacyName, probe };
  }
  return { name: null, probe };
}

async function findRecipientByName(
  name: string,
): Promise<{ id: string; name: string } | null> {
  const [u] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(sql`lower(${users.name}) = lower(${name})`)
    .limit(1);
  if (u?.name) return { id: u.id, name: u.name };
  const [legacy] = await db
    .select({ userId: savesKv.userId, value: savesKv.value })
    .from(savesKv)
    .where(
      sql`${savesKv.key} = ${PROFILE_STORAGE_KEY} and lower(${savesKv.value}->>'name') = lower(${name})`,
    )
    .limit(1);
  const legacyName = (legacy?.value as { name?: unknown } | undefined)?.name;
  if (legacy && typeof legacyName === "string" && legacyName.length > 0) {
    return { id: legacy.userId, name: legacyName };
  }
  return null;
}

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

  const { name: senderName, probe } = await resolveSenderName(senderId);
  if (!senderName) {
    return Response.json(
      { error: "sender_no_name", probe },
      { status: 400 },
    );
  }

  const recipient = await findRecipientByName(recipientNameRaw);
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
    fromName: senderName,
  });

  return Response.json({ ok: true, recipientName: recipient.name });
}
