// 스킬북 — 사용하면 AP 스킬을 학습 (캐릭터의 learnedAPSkills 추가) 후 소비되는 아이템.
// 한 번 학습한 스킬은 같은 책을 또 써도 효과 X (UI 가 사용 차단). 거래 정책:
// - 드랍·NPC 판매로 풀린 책: 마켓 거래 가능
// - 히든 퀘스트·업적 보상: 귀속 (tradable: false)

import type { APSkillId } from "@/adventure/character/apSkills";

export type SkillBookId = "book_shadow_cut";

export type SkillBook = {
  id: SkillBookId;
  name: string;
  description: string;
  /** 학습 대상 AP 스킬 (apSkills.ts 의 id). */
  learnsSkillId: APSkillId;
  /** NPC 판매가. NPC 가 안 팔면 undefined. */
  price?: number;
  /** 마켓 거래 가능 여부. 히든·업적 보상은 false. */
  tradable: boolean;
};

export const SKILL_BOOKS: Record<SkillBookId, SkillBook> = {
  book_shadow_cut: {
    id: "book_shadow_cut",
    name: "스킬북 — 그림자 베기",
    description:
      "검광이 그림자처럼 미끄러져 적의 갑옷을 비껴간다. 사용하면 '그림자 베기' (AP 3) 를 학습한다.",
    learnsSkillId: "shadow_cut",
    price: 1, // PR-0 테스트용 1G. PR-1 에서 정식 가격으로 조정.
    tradable: true,
  },
};

export const SKILL_BOOK_IDS = Object.keys(SKILL_BOOKS) as SkillBookId[];
