import { kv } from "@vercel/kv";
import * as Sentry from "@sentry/nextjs";
import {
  ARENA_MAX_NICKNAME_LEN,
  ARENA_MIN_LEVEL,
  ARENA_MIN_NICKNAME_LEN,
  computeArenaPower,
  pickOpponents,
} from "@/lib/game/arena";
import type { ArenaSnapshot } from "@/lib/game/types";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { addActive, addNewPlayer, setClass } from "@/lib/metrics";

export const runtime = "nodejs";

// Arena 등록 / 조회: 분당 IP당 30회
const ARENA_RATE_LIMIT = 30;
const ARENA_RATE_WINDOW_MS = 60_000;

// 신규 — Redis Hash. field "{nickname}" → Entry.
// 기존 "arena:dummies" (단일 string에 풀 전체)는 race condition + 닉네임 squat 방지 안 됨.
// 마이그레이션: 본 키가 비어 있고 구 키에 데이터가 있으면 1회 옮기고 구 키 삭제.
const KEY = "arena:players";
const LEGACY_KEY = "arena:dummies";

const hasKv = () => !!process.env.KV_REST_API_URL;

type Entry = { snapshot: ArenaSnapshot; ownerId: string; updatedAt: number };

// 1회성 마이그레이션 — 구 풀이 있고 신규 풀이 비어 있으면 옮김 (ownerId 없는 레거시 entry).
// 레거시 entry는 ownerId === "" 으로 표시되어 누구나 첫 재등록 시 새 ownerId 발급 가능.
async function migrateLegacyIfNeeded(): Promise<void> {
  if (!hasKv()) return;
  try {
    const newSize = (await kv.hlen(KEY)) ?? 0;
    if (newSize > 0) return;
    const legacy = await kv.get<Record<string, ArenaSnapshot>>(LEGACY_KEY);
    if (!legacy || Object.keys(legacy).length === 0) return;
    const fields: Record<string, Entry> = {};
    for (const [nick, snap] of Object.entries(legacy)) {
      fields[nick] = { snapshot: snap, ownerId: "", updatedAt: snap.registeredAt ?? Date.now() };
    }
    await kv.hset(KEY, fields);
    await kv.del(LEGACY_KEY);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/arena", op: "migrate" } });
  }
}

async function readAllEntries(): Promise<Record<string, Entry>> {
  if (!hasKv()) return {};
  try {
    const data = await kv.hgetall<Record<string, Entry>>(KEY);
    return data ?? {};
  } catch {
    return {};
  }
}

const isValidStats = (s: unknown): s is ArenaSnapshot["stats"] => {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.maxHp === "number" &&
    typeof o.atk === "number" &&
    typeof o.def === "number" &&
    typeof o.mdef === "number" &&
    typeof o.spd === "number" &&
    typeof o.agi === "number" &&
    typeof o.int === "number"
  );
};

const sanitizeSnapshot = (raw: unknown): ArenaSnapshot | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const nickname =
    typeof o.nickname === "string" ? o.nickname.trim().slice(0, ARENA_MAX_NICKNAME_LEN) : "";
  if (nickname.length < ARENA_MIN_NICKNAME_LEN) return null;
  if (typeof o.level !== "number" || o.level < ARENA_MIN_LEVEL) return null;
  if (typeof o.className !== "string") return null;
  if (!isValidStats(o.stats)) return null;
  const skillNames = Array.isArray(o.equippedSkillNames)
    ? o.equippedSkillNames.filter((x): x is string => typeof x === "string").slice(0, 10)
    : [];
  const itemNames = Array.isArray(o.equippedItemNames)
    ? o.equippedItemNames.filter((x): x is string => typeof x === "string").slice(0, 10)
    : [];
  return {
    nickname,
    level: Math.floor(o.level),
    className: o.className.slice(0, 30),
    stats: o.stats,
    power: computeArenaPower(o.stats, o.level),
    equippedSkillNames: skillNames,
    equippedItemNames: itemNames,
    registeredAt: Date.now(),
  };
};

export async function GET(req: Request) {
  await migrateLegacyIfNeeded();
  const { searchParams } = new URL(req.url);
  const exclude = searchParams.get("nickname")?.trim() || undefined;
  const entries = await readAllEntries();
  // 도전자는 등록된 실제 유저 중에서만 선택 (시드 NPC 제외).
  // ownerId는 클라이언트에 노출하지 않는다 — snapshot만 전달.
  const pool = Object.values(entries).map((e) => e.snapshot);
  const opponents = pickOpponents(pool, exclude);
  const myEntry = exclude ? (entries[exclude]?.snapshot ?? null) : null;
  return Response.json({ ...opponents, my: myEntry, poolSize: pool.length });
}

type RegisterBody = { action: "register"; snapshot: unknown; ownerId?: string | null };
type Body = RegisterBody;

export async function POST(req: Request) {
  if (!hasKv()) {
    return Response.json({ error: "arena disabled" }, { status: 503 });
  }
  const ip = getClientIp(req);
  const rl = await rateLimit(`arena:${ip}`, ARENA_RATE_LIMIT, ARENA_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return tooManyRequests(rl.resetAt);
  }
  try {
    await migrateLegacyIfNeeded();
    const body = (await req.json()) as Body;
    if (body.action === "register") {
      const snap = sanitizeSnapshot(body.snapshot);
      if (!snap) {
        return Response.json(
          { error: `등록 실패 — 레벨 ${ARENA_MIN_LEVEL} 이상, 닉네임 필요` },
          { status: 400 },
        );
      }
      const requestedOwnerId = typeof body.ownerId === "string" ? body.ownerId : null;
      const existing = await kv.hget<Entry>(KEY, snap.nickname);
      let ownerId: string;
      if (existing) {
        // 레거시 entry (ownerId === "")는 첫 재등록 시 토큰 발급 가능 — squat 방지를 위해
        // 클라가 ownerId를 보내지 않은 경우(첫 등록 시도)에 한해 발급. 토큰 보냈는데
        // 빈 ownerId와 매치하려는 건 거부 (다른 사람이 빈 토큰으로 가로채는 경우 차단).
        const isLegacy = existing.ownerId === "";
        if (isLegacy && !requestedOwnerId) {
          ownerId = crypto.randomUUID();
        } else if (!isLegacy && requestedOwnerId === existing.ownerId) {
          ownerId = existing.ownerId;
        } else {
          return Response.json(
            {
              error: "이 닉네임은 이미 등록되어 있습니다 (다른 기기/브라우저). 등록 토큰 불일치.",
            },
            { status: 409 },
          );
        }
      } else {
        // 최초 등록 — 새 ownerId 발급
        ownerId = crypto.randomUUID();
      }
      const entry: Entry = { snapshot: snap, ownerId, updatedAt: Date.now() };
      await kv.hset(KEY, { [snap.nickname]: entry });
      await addNewPlayer(snap.nickname);
      await setClass(snap.nickname, snap.className);
      await addActive(snap.nickname);
      // ownerId는 등록자 응답에만 포함 (클라가 localStorage에 저장).
      return Response.json({ ok: true, snapshot: snap, ownerId });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/arena" } });
    const m = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: m }, { status: 500 });
  }
}
