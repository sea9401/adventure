import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guildMembers, guilds, type GuildBuffSlotRow } from "@/db/schema";
import {
  cumulativeCostForTier,
  isGuildBuffId,
  type GuildBuffSlot,
} from "@/adventure/data/guildBuffs";

// 더 이상 카탈로그(GUILD_BUFFS)에 없는 buffId 의 슬롯을 골라낸다.
// 현재 해당: "gold_boost" (2026-05 "train_speed" 로 교체) — 자동 해제 + 누적 투자 50% 환급.
function partitionStale(buffs: GuildBuffSlotRow[]): {
  kept: GuildBuffSlotRow[];
  refunded: number;
} {
  const kept: GuildBuffSlotRow[] = [];
  let refunded = 0;
  for (const slot of buffs) {
    if (isGuildBuffId(slot.buffId)) {
      kept.push(slot);
    } else {
      refunded += Math.floor(cumulativeCostForTier(slot.tier) * 0.5);
    }
  }
  return { kept, refunded };
}

function isStale(buffs: GuildBuffSlotRow[]): boolean {
  return buffs.some((s) => !isGuildBuffId(s.buffId));
}

// 유저의 길드 활성 버프 슬롯을 한 번에 조회 — 보상 곱셈 적용 등 서버 측 경로 공용.
// 길드 미가입 / 슬롯 0 / 카탈로그 검증 실패면 빈 배열. stale buff 정리는 별도 prune 경로
// (GET /api/guilds/buffs · /api/guilds/me) 가 처리하므로 여기서는 카탈로그에 있는 것만 통과.
export async function getActiveGuildBuffsForUser(
  userId: string,
): Promise<GuildBuffSlot[]> {
  const member = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId))
    .limit(1);
  if (member.length === 0) return [];
  const guildId = member[0].guildId;
  const rows = await db
    .select({ buffs: guilds.buffs })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);
  const raw = rows[0]?.buffs ?? [];
  // 카탈로그 검증 + 데이터 모양 정리 (jsonb 라 신뢰 못함).
  const out: GuildBuffSlot[] = [];
  for (const slot of raw) {
    if (!slot || typeof slot !== "object") continue;
    const buffId = (slot as { buffId?: unknown }).buffId;
    const tier = (slot as { tier?: unknown }).tier;
    const installedAt = (slot as { installedAt?: unknown }).installedAt;
    if (typeof buffId !== "string" || typeof tier !== "number") continue;
    if (!isGuildBuffId(buffId)) continue;
    out.push({
      buffId,
      tier: tier as GuildBuffSlot["tier"],
      installedAt: typeof installedAt === "string" ? installedAt : "",
    });
  }
  return out;
}

// 길드 row 의 buffs 에서 무효 슬롯을 제거하고 fameAvailable 에 50% 환급.
// 변경이 필요하면 한 트랜잭션 안에서 row 를 잠그고 갱신한 뒤 새 값을 반환, 아니면 입력 그대로 반환.
// GET /api/guilds/buffs · /api/guilds/me 같은 읽기 경로에서 lazy 하게 호출 — 다음 조회 시 자동 정리된다.
export async function pruneStaleGuildBuffs(guild: {
  id: number;
  buffs: GuildBuffSlotRow[];
  fameAvailable: number;
}): Promise<{ buffs: GuildBuffSlotRow[]; fameAvailable: number }> {
  if (!isStale(guild.buffs ?? [])) {
    return { buffs: guild.buffs ?? [], fameAvailable: guild.fameAvailable };
  }
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(guilds)
      .where(eq(guilds.id, guild.id))
      .for("update");
    const fresh = rows[0];
    if (!fresh) {
      // row 가 사라졌으면(해체 등) 메모리 상으로만 정리해 반환.
      const { kept } = partitionStale(guild.buffs ?? []);
      return { buffs: kept, fameAvailable: guild.fameAvailable };
    }
    const freshBuffs = fresh.buffs ?? [];
    // 잠근 뒤 최신 값으로 다시 판정 — 동시 요청이 먼저 정리했을 수 있다.
    if (!isStale(freshBuffs)) {
      return { buffs: freshBuffs, fameAvailable: fresh.fameAvailable };
    }
    const { kept, refunded } = partitionStale(freshBuffs);
    const nextFame = fresh.fameAvailable + refunded;
    const upd = await tx
      .update(guilds)
      .set({ buffs: kept, fameAvailable: nextFame })
      .where(eq(guilds.id, guild.id))
      .returning({ buffs: guilds.buffs, fameAvailable: guilds.fameAvailable });
    return { buffs: upd[0].buffs, fameAvailable: upd[0].fameAvailable };
  });
}
