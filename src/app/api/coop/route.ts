import { kv } from "@vercel/kv";
import * as Sentry from "@sentry/nextjs";
import { COOP_BOSSES, coopTierForRatio, sumCoopTierRewards } from "@/lib/game/data";
import type { ActiveCoopBoss } from "@/lib/game/types";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { addActive, addBossKill } from "@/lib/metrics";

export const runtime = "nodejs";

// Coop 액션: 분당 IP당 60회 (공격 쿨 30초라 자연스러운 한도, 어뷰즈 방지)
const COOP_RATE_LIMIT = 60;
const COOP_RATE_WINDOW_MS = 60_000;

const KEY = "coop:sessions";
const STALE_MS = 3 * 60 * 60 * 1000; // 3시간 후 청소
const MAX_ACTIVE = 10;

const hasKv = () => !!process.env.KV_REST_API_URL;

type Sessions = Record<string, ActiveCoopBoss>;

async function readSessions(): Promise<Sessions> {
  if (!hasKv()) return {};
  try {
    const data = await kv.get<Sessions>(KEY);
    if (!data) return {};
    // Cleanup
    const now = Date.now();
    let mutated = false;
    for (const [sid, b] of Object.entries(data)) {
      if (b.defeated && b.defeatedAt && now - b.defeatedAt > STALE_MS) {
        delete data[sid];
        mutated = true;
      } else if (!b.defeated && now > b.expiresAt) {
        delete data[sid];
        mutated = true;
      }
    }
    if (mutated) await kv.set(KEY, data);
    return data;
  } catch {
    return {};
  }
}

async function writeSessions(s: Sessions): Promise<void> {
  await kv.set(KEY, s);
}

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  if (!hasKv()) {
    return Response.json({ bosses: [], disabled: true });
  }
  const sessions = await readSessions();
  return Response.json({ bosses: Object.values(sessions) });
}

type SummonBody = { action: "summon"; nickname: string; bossId: string };
type AttackBody = {
  action: "attack";
  nickname: string;
  sessionId: string;
  damage: number;
};
type ClaimBody = { action: "claim"; nickname: string; sessionId: string };
type Body = SummonBody | AttackBody | ClaimBody;

export async function POST(req: Request) {
  if (!hasKv()) {
    return Response.json({ error: "coop disabled" }, { status: 503 });
  }
  // Rate limit
  const ip = getClientIp(req);
  const rl = await rateLimit(`coop:${ip}`, COOP_RATE_LIMIT, COOP_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return tooManyRequests(rl.resetAt);
  }
  try {
    const body = (await req.json()) as Body;
    const sessions = await readSessions();

    if (body.action === "summon") {
      if (Object.keys(sessions).length >= MAX_ACTIVE) {
        return Response.json(
          { error: `최대 ${MAX_ACTIVE}마리까지만 동시 소환 가능합니다` },
          { status: 409 },
        );
      }
      const def = COOP_BOSSES[body.bossId];
      if (!def) return Response.json({ error: "unknown boss" }, { status: 400 });
      const nickname = (body.nickname ?? "").trim().slice(0, 20);
      if (!nickname) return Response.json({ error: "닉네임 필요" }, { status: 400 });
      const now = Date.now();
      const sessionId = newSessionId();
      const state: ActiveCoopBoss = {
        sessionId,
        bossId: def.id,
        name: def.name,
        hp: def.hp,
        maxHp: def.hp,
        contributors: {},
        summonedBy: nickname,
        summonedAt: now,
        expiresAt: now + def.durationSec * 1000,
        defeated: false,
        claimedBy: [],
      };
      sessions[sessionId] = state;
      await writeSessions(sessions);
      return Response.json({ boss: state });
    }

    if (body.action === "attack") {
      const state = sessions[body.sessionId];
      if (!state) return Response.json({ error: "no active boss" }, { status: 404 });
      if (state.defeated) return Response.json({ error: "이미 처치됨" }, { status: 409 });
      if (Date.now() > state.expiresAt) {
        delete sessions[body.sessionId];
        await writeSessions(sessions);
        return Response.json({ error: "시간 만료" }, { status: 410 });
      }
      const nickname = (body.nickname ?? "").trim().slice(0, 20);
      if (!nickname) return Response.json({ error: "닉네임 필요" }, { status: 400 });
      const damage = Math.max(0, Math.floor(body.damage ?? 0));
      const remaining = Math.max(0, state.hp);
      const applied = Math.min(damage, remaining);
      state.hp = remaining - applied;
      const c = state.contributors[nickname] ?? { damage: 0, attacks: 0 };
      c.damage += applied;
      c.attacks += 1;
      state.contributors[nickname] = c;
      if (state.hp <= 0 && !state.defeated) {
        state.defeated = true;
        state.defeatedAt = Date.now();
        await addBossKill(state.name);
      }
      await addActive(nickname);
      await writeSessions(sessions);
      return Response.json({ boss: state, applied });
    }

    if (body.action === "claim") {
      const state = sessions[body.sessionId];
      if (!state) return Response.json({ error: "no active boss" }, { status: 404 });
      if (!state.defeated)
        return Response.json({ error: "아직 처치되지 않았습니다" }, { status: 409 });
      const nickname = (body.nickname ?? "").trim().slice(0, 20);
      if (!nickname) return Response.json({ error: "닉네임 필요" }, { status: 400 });
      if (state.claimedBy.includes(nickname)) {
        return Response.json({ error: "이미 수령했습니다" }, { status: 409 });
      }
      const myDamage = state.contributors[nickname]?.damage ?? 0;
      if (myDamage <= 0) {
        return Response.json({ error: "기여한 데미지 없음" }, { status: 403 });
      }
      // 보스 HP 대비 누적 데미지 비율로 티어 판정 (다른 기여자 영향 X). 클램프 1.0.
      const damageRatio = Math.min(1, myDamage / Math.max(1, state.maxHp));
      const tier = coopTierForRatio(damageRatio);
      if (!tier) {
        return Response.json(
          { error: "최소 기여 미달 (HP의 2% 이상 데미지 필요)" },
          { status: 403 },
        );
      }
      const def = COOP_BOSSES[state.bossId];
      const reward = sumCoopTierRewards(tier, def.rewardTiers.rewards);
      state.claimedBy.push(nickname);
      // 모든 기여자가 보상 수령했으면 즉시 청소
      const contributors = Object.keys(state.contributors).filter(
        (n) => (state.contributors[n]?.damage ?? 0) > 0,
      );
      const allClaimed = contributors.every((n) => state.claimedBy.includes(n));
      if (allClaimed) {
        delete sessions[state.sessionId];
      }
      await writeSessions(sessions);
      return Response.json({ boss: state, reward, tier, damageRatio });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/coop" } });
    const m = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: m }, { status: 500 });
  }
}
