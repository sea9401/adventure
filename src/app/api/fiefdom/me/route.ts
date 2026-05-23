import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fiefdoms, guildMembers, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { defaultFiefdomState } from "@/adventure/fiefdom/builderData";
import type { FiefdomState } from "@/adventure/fiefdom/types";

// GET /api/fiefdom/me — 내 길드의 영지 상태.
// 길드 미가입 → 403. 길드 있으면 fiefdom 행이 없을 경우 default state 자동 생성 후 반환.
// 응답: { guildId, guildName, state, shieldUntil }.
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const membership = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId))
    .limit(1);
  if (!membership[0]) {
    return Response.json({ error: "no_guild" }, { status: 403 });
  }
  const guildId = membership[0].guildId;

  const guildRow = await db
    .select({ name: guilds.name })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);
  const guildName = guildRow[0]?.name ?? "길드";

  const existing = await db
    .select()
    .from(fiefdoms)
    .where(eq(fiefdoms.guildId, guildId))
    .limit(1);

  if (existing[0]) {
    return Response.json({
      guildId,
      guildName,
      state: existing[0].state as FiefdomState,
      shieldUntil: existing[0].shieldUntil?.toISOString() ?? null,
    });
  }

  // 첫 진입 — default state 자동 생성.
  const fresh = defaultFiefdomState();
  await db.insert(fiefdoms).values({ guildId, state: fresh });
  return Response.json({
    guildId,
    guildName,
    state: fresh,
    shieldUntil: null,
  });
}

// PUT /api/fiefdom/me — state 갱신. 빌드/훈련/틱 후 클라에서 debounced 로 전송.
// 약식 검증만 수행 — 음수 자원, 비정상 buildings 길이 등. MVP 라 권위적 tick 시뮬은 생략.
// 본격 anti-cheat 는 다음 페이즈에서 server-side tick 으로 옮길 예정.
export async function PUT(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const membership = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId))
    .limit(1);
  if (!membership[0]) {
    return Response.json({ error: "no_guild" }, { status: 403 });
  }
  const guildId = membership[0].guildId;

  let body: { state?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const validated = validateState(body.state);
  if (!validated.ok) {
    return Response.json({ error: validated.reason }, { status: 400 });
  }

  await db
    .update(fiefdoms)
    .set({ state: validated.state, updatedAt: new Date() })
    .where(eq(fiefdoms.guildId, guildId));

  return Response.json({ ok: true });
}

function validateState(s: unknown): { ok: true; state: FiefdomState } | { ok: false; reason: string } {
  if (!s || typeof s !== "object") return { ok: false, reason: "state_required" };
  const o = s as Record<string, unknown>;
  const r = o.resources as Record<string, unknown> | undefined;
  if (!r) return { ok: false, reason: "resources_missing" };
  for (const k of ["gold", "wood", "food"] as const) {
    const v = r[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
      return { ok: false, reason: `resources_${k}_invalid` };
  }
  if (!Array.isArray(o.buildings)) return { ok: false, reason: "buildings_invalid" };
  if ((o.buildings as unknown[]).length > 100) return { ok: false, reason: "buildings_too_many" };
  if (!o.hero || typeof o.hero !== "object") return { ok: false, reason: "hero_missing" };
  return { ok: true, state: s as FiefdomState };
}
