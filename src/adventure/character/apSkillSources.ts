// AP 스킬 → 획득 경로 역추적.
// 학습 출처(learnedAPSkills) 는 따로 기록하지 않으므로, 정적 데이터(SKILL_BOOKS / QUESTS /
// MONSTERS) 에 더해 코드로만 지급되는 마일스톤 보상(onBattleEnd.ts)·NPC 대화 판매를
// 수동 매핑해 합쳐 보여준다.

import type { APSkillId } from "./apSkills";
import {
  SKILL_BOOKS,
  type SkillBook,
  type SkillBookId,
} from "@/adventure/data/skillBooks";
import { QUESTS } from "@/adventure/data/quests";
import { MONSTERS } from "@/adventure/data/monsters";
import { NPCS, type NpcId } from "@/adventure/data/npcs";
import type { RegionId } from "@/adventure/data/world";

// 책에 price 가 박혀 있으면 NPC 판매. 어느 NPC 가 파는지는 다이얼로그 안에 흩어져 있어
// 한 곳에 모아 둠 — 새 NPC 판매를 붙이면 여기에 한 줄 추가.
const NPC_SHOP_VENDOR: Partial<Record<SkillBookId, NpcId>> = {
  book_shadow_cut: "village_blacksmith_bold",
  book_mending: "unhyang_herbalist",
  book_resolve: "dustford_keeper",
  book_expose_weakness: "dustford_hunter",
};

// onBattleEnd.ts 에서 카운터/플래그 기반으로 직접 지급되는 책 — 데이터로 빼낼 수 없어 수동.
// 새 마일스톤이 추가되면 여기와 onBattleEnd.ts 양쪽을 같이 손봐야 한다.
const MILESTONE_GRANTS: Partial<Record<SkillBookId, string>> = {
  book_mad_slash: "무피해 100회 승리",
  book_deep_wound: "보스 누적 50회 처치",
  book_frenzy: "누적 처치 1000회",
  book_thunder_strike: "운봉의 거인 10회 처치",
  book_light_glide: "천공인의 왕 처치",
};

export type APSkillSource =
  | { kind: "npc_shop"; npcId: NpcId; npcName: string; price: number }
  | {
      kind: "quest";
      questId: string;
      questTitle: string;
      npcName?: string;
      regionId: RegionId;
      hidden: boolean;
    }
  | { kind: "monster_drop"; monsterName: string; chance: number }
  | { kind: "milestone"; label: string };

export type APSkillAcquisition = {
  book: SkillBook | null;
  sources: APSkillSource[];
};

function npcName(id: NpcId): string | undefined {
  return NPCS.find((n) => n.id === id)?.name;
}

export function getAPSkillAcquisition(
  apSkillId: APSkillId,
): APSkillAcquisition {
  const book =
    Object.values(SKILL_BOOKS).find((b) => b.learnsSkillId === apSkillId) ??
    null;
  if (!book) return { book: null, sources: [] };

  const sources: APSkillSource[] = [];

  // 1. NPC 대화 판매 (book.price 설정 + 위 매핑)
  if (book.price !== undefined) {
    const npcId = NPC_SHOP_VENDOR[book.id];
    if (npcId) {
      sources.push({
        kind: "npc_shop",
        npcId,
        npcName: npcName(npcId) ?? npcId,
        price: book.price,
      });
    }
  }

  // 2. 퀘스트 보상
  for (const q of QUESTS) {
    if (!q.reward.skillBooks?.includes(book.id)) continue;
    sources.push({
      kind: "quest",
      questId: q.id,
      questTitle: q.title,
      npcName: q.giverNpcId ? npcName(q.giverNpcId) : undefined,
      regionId: q.regionId,
      hidden: !!q.hidden,
    });
  }

  // 3. 몬스터 드랍
  for (const monster of Object.values(MONSTERS)) {
    for (const drop of monster.drops ?? []) {
      if (drop.kind === "skill_book" && drop.bookId === book.id) {
        sources.push({
          kind: "monster_drop",
          monsterName: monster.name,
          chance: drop.chance,
        });
      }
    }
  }

  // 4. 코드로 직접 지급되는 마일스톤
  const milestone = MILESTONE_GRANTS[book.id];
  if (milestone) sources.push({ kind: "milestone", label: milestone });

  return { book, sources };
}
