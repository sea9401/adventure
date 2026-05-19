import "server-only";

// 퀘스트 보상 서버 lib — /api/quests/claim 의 핵심 로직.
//
// 권위: 서버. 클라는 questId 만 보내고 서버가 quest definition (QUESTS) 의 reward 를
// 직접 적용. dedup 은 quest-progress.v2 의 state 가 "ready" 인지로 판정 — 이미
// "completed"/"available" (이전 claim 후) 이면 idempotent no-op.
//
// 적용 saves: character.v2 · inventory.v2 · crafting.v2 · adventure-log.v2 ·
// storyFlags.v2 · quest-progress.v2 (+ 길드 버프 곱셈은 별도 readonly fetch).
//
// 스코프: 파라곤 overflow EXP 와 vitHpBonus 는 본 PR 미포함 — 둘 다 max-level 이거나
// 레벨업 직후 잠깐만 노출되는 경계 케이스. 별도 PR 로 보강 예정.

import { and, eq, inArray } from "drizzle-orm";
import { savesKv } from "@/db/schema";
import { upsertSave, type DbExecutor } from "@/lib/server/savesKv";
import { getActiveGuildBuffsForUser } from "@/lib/server/guildBuffs";
import {
  applyExpGain,
  applyNewbieBonus,
  MAX_LEVEL,
  XP_RATE_MULT,
} from "@/lib/leveling";
import { computeParagonBonus } from "@/lib/paragon";
import {
  maxHpForLevel,
  maxMpForLevel,
} from "@/adventure/character/defaults";
import { potionMax, type PotionId, POTIONS } from "@/adventure/data/potions";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { ITEMS, type ItemId } from "@/adventure/data/items";
import { RECIPES } from "@/adventure/data/recipes";
import { SKILL_BOOKS, type SkillBookId } from "@/adventure/data/skillBooks";
import { resolveBuffMultiplier } from "@/adventure/data/guildBuffs";
import {
  getQuestById,
  type Quest,
  type QuestReward,
} from "@/adventure/data/quests";
import {
  defaultQuestEntry,
  QUEST_PROGRESS_KEY,
  type QuestProgressEntry,
  type QuestProgressMap,
} from "@/adventure/quests/storage";
import {
  QUEST_COMPLETION_DIRECT,
  QUEST_COMPLETION_GROUPS,
  type QuestSideEffect,
} from "@/adventure/quests/questCompletionData";
import { STORY_FLAGS_STORAGE_KEY } from "@/adventure/storyFlags/storage";

const REWARD_SAVES_KEYS = [
  "character.v2",
  "inventory.v2",
  "crafting.v2",
  "adventure-log.v2",
  STORY_FLAGS_STORAGE_KEY,
  QUEST_PROGRESS_KEY,
  "paragon.v1",
] as const;

type SavesSnapshot = Partial<
  Record<(typeof REWARD_SAVES_KEYS)[number], unknown>
>;

async function readSavesForUpdate(
  tx: DbExecutor,
  userId: string,
): Promise<SavesSnapshot> {
  const rows = await tx
    .select({ key: savesKv.key, value: savesKv.value })
    .from(savesKv)
    .where(
      and(
        eq(savesKv.userId, userId),
        inArray(savesKv.key, REWARD_SAVES_KEYS as unknown as string[]),
      ),
    )
    .for("update");
  const out: SavesSnapshot = {};
  for (const r of rows) {
    if ((REWARD_SAVES_KEYS as readonly string[]).includes(r.key)) {
      out[r.key as keyof SavesSnapshot] = r.value;
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// Pure compute helpers — 각 save key 의 snapshot 을 받아 새 snapshot + summary 토큰 반환.
// ──────────────────────────────────────────────────────────────

function recipeName(id: string): string {
  return RECIPES.find((r) => r.id === id)?.name ?? id;
}
function plural(name: string, count: number): string {
  return count > 1 ? `${name} ×${count}` : name;
}

type Computed = {
  character: Record<string, unknown>;
  inventory: Record<string, unknown>;
  crafting: Record<string, unknown>;
  log: Record<string, unknown>;
  flags: Record<string, unknown>;
  questProgress: QuestProgressMap;
  paragon: Record<string, unknown>;
  tokens: string[];
};

function applyGoldFame(
  char: Record<string, unknown>,
  gold: number,
  fame: number,
): Record<string, unknown> {
  if (gold <= 0 && fame <= 0) return char;
  const curGold = typeof char.gold === "number" ? char.gold : 0;
  const curFame = typeof char.fame === "number" ? char.fame : 0;
  return {
    ...char,
    gold: gold > 0 ? curGold + gold : curGold,
    fame: fame > 0 ? curFame + fame : curFame,
  };
}

// EXP 적용 + 레벨업 시 hp/mp 풀회복. paragon overflow 는 별도 처리 (반환 객체에 분리).
function applyExp(
  char: Record<string, unknown>,
  rawExp: number,
): { char: Record<string, unknown>; overflow: number } {
  if (rawExp <= 0) return { char, overflow: 0 };
  const curLevel = typeof char.level === "number" ? char.level : 1;
  const curExp = typeof char.exp === "number" ? char.exp : 0;
  const next = applyExpGain(curLevel, curExp, rawExp);
  if (next.levelsGained > 0) {
    return {
      char: {
        ...char,
        level: next.level,
        exp: next.exp,
        hp: maxHpForLevel(next.level),
        mp: maxMpForLevel(next.level),
      },
      overflow: next.overflowExp,
    };
  }
  return {
    char: { ...char, level: next.level, exp: next.exp },
    overflow: next.overflowExp,
  };
}

function applyParagonOverflow(
  paragon: Record<string, unknown>,
  overflow: number,
): Record<string, unknown> {
  if (overflow <= 0) return paragon;
  const cur = typeof paragon.paragonExp === "number" ? paragon.paragonExp : 0;
  return { ...paragon, paragonExp: cur + overflow };
}

function applyPotions(
  inv: Record<string, unknown>,
  potions: NonNullable<QuestReward["potions"]>,
  tokens: string[],
): Record<string, unknown> {
  if (!potions.length) return inv;
  const cur = (inv.potions as Record<string, number> | undefined) ?? {};
  const cap = potionMax(
    typeof inv.potionCapacityBonus === "number" ? inv.potionCapacityBonus : 0,
  );
  const next = { ...cur };
  let changed = false;
  for (const p of potions) {
    const have = next[p.id] ?? 0;
    const room = Math.max(0, cap - have);
    const added = Math.min(p.count, room);
    if (added > 0) {
      next[p.id] = have + added;
      changed = true;
    }
    const name = POTIONS[p.id as PotionId]?.name ?? p.id;
    if (added < p.count) {
      const lost = p.count - added;
      if (added > 0) {
        tokens.push(`${plural(name, added)} (${lost}개는 가방 가득 차 폐기)`);
      } else {
        tokens.push(`${plural(name, p.count)} (가방 가득 차 폐기)`);
      }
    } else {
      tokens.push(plural(name, p.count));
    }
  }
  return changed ? { ...inv, potions: next } : inv;
}

function applyMaterials(
  inv: Record<string, unknown>,
  materials: NonNullable<QuestReward["materials"]>,
  tokens: string[],
): Record<string, unknown> {
  if (!materials.length) return inv;
  const cur = (inv.materials as Record<string, number> | undefined) ?? {};
  const next = { ...cur };
  for (const m of materials) {
    next[m.id] = (next[m.id] ?? 0) + m.count;
    tokens.push(plural(MATERIALS[m.id as MaterialId]?.name ?? m.id, m.count));
  }
  return { ...inv, materials: next };
}

function applyItems(
  inv: Record<string, unknown>,
  items: NonNullable<QuestReward["items"]>,
  tokens: string[],
): Record<string, unknown> {
  if (!items.length) return inv;
  const cur = (inv.equipment as Record<string, number> | undefined) ?? {};
  const next = { ...cur };
  for (const it of items) {
    next[it.id] = (next[it.id] ?? 0) + it.count;
    tokens.push(plural(ITEMS[it.id as ItemId]?.name ?? it.id, it.count));
  }
  return { ...inv, equipment: next };
}

function applySkillBooks(
  inv: Record<string, unknown>,
  ids: NonNullable<QuestReward["skillBooks"]>,
  tokens: string[],
): Record<string, unknown> {
  if (!ids.length) return inv;
  const cur = (inv.skillBooks as Record<string, number> | undefined) ?? {};
  const next = { ...cur };
  for (const id of ids) {
    next[id] = (next[id] ?? 0) + 1;
    tokens.push(SKILL_BOOKS[id as SkillBookId]?.name ?? id);
  }
  return { ...inv, skillBooks: next };
}

function applyPotionCapacityBonus(
  inv: Record<string, unknown>,
  bonus: number,
  tokens: string[],
): Record<string, unknown> {
  if (bonus <= 0) return inv;
  const cur =
    typeof inv.potionCapacityBonus === "number" ? inv.potionCapacityBonus : 0;
  tokens.push(`포션 최대 보유량 +${bonus}`);
  return { ...inv, potionCapacityBonus: cur + bonus };
}

// learnRecipe 정책 그대로 — known + shareable 양쪽 등록.
function applyRecipes(
  crafting: Record<string, unknown>,
  ids: NonNullable<QuestReward["recipes"]>,
  tokens: string[],
): Record<string, unknown> {
  if (!ids.length) return crafting;
  const known = Array.isArray(crafting.known)
    ? [...(crafting.known as string[])]
    : [];
  const shareable = Array.isArray(crafting.shareable)
    ? [...(crafting.shareable as string[])]
    : [];
  for (const id of ids) {
    if (!known.includes(id)) known.push(id);
    if (!shareable.includes(id)) shareable.push(id);
    tokens.push(recipeName(id));
  }
  return { ...crafting, known, shareable };
}

function applyTitle(
  log: Record<string, unknown>,
  titleId: string,
  nowMs: number,
): Record<string, unknown> {
  const titles =
    (log.titles as Record<string, unknown> | undefined) ?? {};
  if (titles[titleId]) return log;
  return { ...log, titles: { ...titles, [titleId]: { obtainedAt: nowMs } } };
}

function applyFlag(
  flags: Record<string, unknown>,
  flagId: string,
): Record<string, unknown> {
  const arr = Array.isArray(flags.flags) ? (flags.flags as string[]) : [];
  if (arr.includes(flagId)) return flags;
  return { ...flags, flags: [...arr, flagId] };
}

// ON_COMPLETE + ON_ALL_COMPLETE 적용. 새 questProgress 가 기준 — 방금 완료한 의뢰는
// 이미 state="completed" 로 적용된 후에 호출되므로 group all-completed 판정 가능.
function applySideEffects(
  questId: string,
  log: Record<string, unknown>,
  flags: Record<string, unknown>,
  questProgress: QuestProgressMap,
  nowMs: number,
): { log: Record<string, unknown>; flags: Record<string, unknown> } {
  let outLog = log;
  let outFlags = flags;

  const apply = (effects: readonly QuestSideEffect[]) => {
    for (const e of effects) {
      if (e.kind === "grantTitle") {
        outLog = applyTitle(outLog, e.titleId, nowMs);
      } else {
        outFlags = applyFlag(outFlags, e.flag);
      }
    }
  };

  const direct = QUEST_COMPLETION_DIRECT[questId];
  if (direct) apply(direct);

  for (const group of QUEST_COMPLETION_GROUPS) {
    if (!group.members.includes(questId)) continue;
    const others = group.members.filter((m) => m !== questId);
    if (
      others.every(
        (m) =>
          (questProgress[m] ?? defaultQuestEntry()).state === "completed",
      )
    ) {
      apply(group.effects);
    }
  }
  return { log: outLog, flags: outFlags };
}

// ──────────────────────────────────────────────────────────────
// Orchestrator
// ──────────────────────────────────────────────────────────────

export class QuestClaimError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "QuestClaimError";
  }
}

export type QuestClaimOutcome = {
  /** 이번 호출이 실제로 적용했는지. false 면 이미 처리된 idempotent retry. */
  applied: boolean;
  questTitle: string;
  tokens: string[];
  saves: SavesSnapshot;
};

export async function applyQuestClaim(
  tx: DbExecutor,
  userId: string,
  questId: string,
  // 길드 버프는 tx 시작 전에 readonly 로 미리 fetch 해 넘긴다 (멤버십은 tx 단위로
  // 안 바뀌므로 안전 — 곱셈만 사용).
  guildBuffs: Awaited<ReturnType<typeof getActiveGuildBuffsForUser>>,
  nowMs = Date.now(),
): Promise<QuestClaimOutcome> {
  const quest: Quest | undefined = getQuestById(questId);
  if (!quest) throw new QuestClaimError("unknown_quest");

  const saves = await readSavesForUpdate(tx, userId);
  const progressRaw = (saves[QUEST_PROGRESS_KEY] as QuestProgressMap | undefined) ?? {};
  const entry = progressRaw[questId] ?? defaultQuestEntry();

  if (entry.state !== "ready") {
    // idempotent — 이미 처리됐거나, 처음부터 ready 가 아닌 잘못된 호출.
    return {
      applied: false,
      questTitle: quest.title,
      tokens: [],
      saves,
    };
  }

  // 1) Quest progress entry 전환.
  const nextEntry: QuestProgressEntry = {
    ...entry,
    state: quest.repeatable ? "available" : "completed",
    progress: 0,
    completedCount: entry.completedCount + 1,
    lastCompletedAt: nowMs,
  };
  const progressNext: QuestProgressMap = {
    ...progressRaw,
    [questId]: nextEntry,
  };

  // 2) Reward 계산 + 적용.
  const charPrev =
    (saves["character.v2"] as Record<string, unknown> | undefined) ?? {};
  const invPrev =
    (saves["inventory.v2"] as Record<string, unknown> | undefined) ?? {};
  const craftingPrev =
    (saves["crafting.v2"] as Record<string, unknown> | undefined) ?? {};
  const logPrev =
    (saves["adventure-log.v2"] as Record<string, unknown> | undefined) ?? {};
  const flagsPrev =
    (saves[STORY_FLAGS_STORAGE_KEY] as Record<string, unknown> | undefined) ?? {};
  const paragonPrev =
    (saves["paragon.v1"] as Record<string, unknown> | undefined) ?? {};

  // 멀티플라이어 — 길드 버프 + 파라곤(풍요).
  const fameMult = resolveBuffMultiplier(guildBuffs, "fame_mult");
  const expMult = resolveBuffMultiplier(guildBuffs, "exp_mult");
  const paragonBonus = computeParagonBonus(
    (paragonPrev.allocations as Record<string, number> | undefined) ?? {},
  );
  const paragonRewardMult = 1 + (paragonBonus.pctGoldExp ?? 0) / 100;

  const tokens: string[] = [];

  // gold/fame
  const gold = Math.floor((quest.reward.gold ?? 0) * paragonRewardMult);
  const fameBase = quest.reward.fame ?? 0;
  const fame = Math.floor(fameBase * fameMult);
  let charNext = applyGoldFame(charPrev, gold, fame);
  if (gold > 0) tokens.push(`골드 +${gold}`);
  if (fame > 0) tokens.push(`명성 +${fame}`);

  // exp (with newbie + guild + paragon mults)
  let paragonNext = paragonPrev;
  const baseExp = quest.reward.exp ?? 0;
  if (baseExp > 0) {
    const playerLevel =
      typeof charNext.level === "number" ? charNext.level : 1;
    const atMaxLevel = playerLevel >= MAX_LEVEL;
    const expBonus = applyNewbieBonus(baseExp, playerLevel);
    const boosted = Math.floor(
      expBonus.gained * expMult * XP_RATE_MULT * paragonRewardMult,
    );
    if (atMaxLevel) {
      // 만렙 — 전액 파라곤으로.
      paragonNext = applyParagonOverflow(paragonNext, boosted);
      tokens.push(`EXP +${boosted} (파라곤)`);
    } else {
      const { char: c2, overflow } = applyExp(charNext, boosted);
      charNext = c2;
      if (overflow > 0) {
        paragonNext = applyParagonOverflow(paragonNext, overflow);
      }
      tokens.push(
        `EXP +${boosted}${expBonus.bonusApplied ? " (신참 ×2)" : ""}`,
      );
    }
  }

  // 인벤토리 계열.
  let invNext = invPrev;
  invNext = applyPotions(invNext, quest.reward.potions ?? [], tokens);
  invNext = applyMaterials(invNext, quest.reward.materials ?? [], tokens);
  invNext = applyItems(invNext, quest.reward.items ?? [], tokens);
  invNext = applyPotionCapacityBonus(
    invNext,
    quest.reward.potionCapacityBonus ?? 0,
    tokens,
  );
  invNext = applySkillBooks(invNext, quest.reward.skillBooks ?? [], tokens);

  // 크래프팅 (recipes).
  const craftingNext = applyRecipes(
    craftingPrev,
    quest.reward.recipes ?? [],
    tokens,
  );

  // Side effects — quest progress 갱신본을 넘겨 group all-completed 판정 가능.
  const { log: logNext, flags: flagsNext } = applySideEffects(
    questId,
    logPrev,
    flagsPrev,
    progressNext,
    nowMs,
  );

  // 3) Write back.
  if (charNext !== charPrev) {
    await upsertSave(tx, userId, "character.v2", charNext);
  }
  if (invNext !== invPrev) {
    await upsertSave(tx, userId, "inventory.v2", invNext);
  }
  if (craftingNext !== craftingPrev) {
    await upsertSave(tx, userId, "crafting.v2", craftingNext);
  }
  if (logNext !== logPrev) {
    await upsertSave(tx, userId, "adventure-log.v2", logNext);
  }
  if (flagsNext !== flagsPrev) {
    await upsertSave(tx, userId, STORY_FLAGS_STORAGE_KEY, flagsNext);
  }
  if (paragonNext !== paragonPrev) {
    await upsertSave(tx, userId, "paragon.v1", paragonNext);
  }
  // quest progress 는 항상 새 값.
  await upsertSave(tx, userId, QUEST_PROGRESS_KEY, progressNext);

  const out: Computed = {
    character: charNext,
    inventory: invNext,
    crafting: craftingNext,
    log: logNext,
    flags: flagsNext,
    questProgress: progressNext,
    paragon: paragonNext,
    tokens,
  };

  return {
    applied: true,
    questTitle: quest.title,
    tokens: out.tokens,
    saves: {
      "character.v2": out.character,
      "inventory.v2": out.inventory,
      "crafting.v2": out.crafting,
      "adventure-log.v2": out.log,
      [STORY_FLAGS_STORAGE_KEY]: out.flags,
      [QUEST_PROGRESS_KEY]: out.questProgress,
      "paragon.v1": out.paragon,
    },
  };
}
