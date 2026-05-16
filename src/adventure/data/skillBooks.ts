// 스킬북 — 사용하면 AP 스킬을 학습 (캐릭터의 learnedAPSkills 추가) 후 소비되는 아이템.
// 한 번 학습한 스킬은 같은 책을 또 써도 효과 X (UI 가 사용 차단). 거래 정책:
// - 드랍·NPC 판매로 풀린 책: 마켓 거래 가능
// - 히든 퀘스트·업적 보상: 귀속 (tradable: false)

import type { APSkillId } from "@/adventure/character/apSkills";

export type SkillBookId =
  | "book_shadow_cut"
  | "book_extra_evade"
  | "book_mending"
  | "book_heaven_slay"
  | "book_deep_wound";

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
    price: 1500,
    tradable: true,
  },
  book_extra_evade: {
    id: "book_extra_evade",
    name: "스킬북 — 추가 회피",
    description:
      "산적이 흘리고 간 너덜너덜한 보법서. 사용하면 '추가 회피' (AP 1) 를 학습한다.",
    learnsSkillId: "extra_evade",
    tradable: true,
  },
  book_mending: {
    id: "book_mending",
    name: "스킬북 — 회복술",
    description:
      "낡은 약초학 필사본. 사용하면 '회복술' (AP 3) 을 학습한다.",
    learnsSkillId: "mending",
    price: 800,
    tradable: true,
  },
  book_heaven_slay: {
    id: "book_heaven_slay",
    name: "스킬북 — 천살",
    description:
      "구름 위에서 내려온 검결의 잔편. 사용하면 '천살' (AP 5) 을 학습한다. 귀속.",
    learnsSkillId: "heaven_slay",
    tradable: false,
  },
  book_deep_wound: {
    id: "book_deep_wound",
    name: "스킬북 — 깊은 상처",
    description:
      "수많은 보스를 베어 넘긴 자에게만 보이는 핏빛 비전서. 사용하면 '깊은 상처' (AP 3) 를 학습한다. 귀속.",
    learnsSkillId: "deep_wound",
    tradable: false,
  },
};

export const SKILL_BOOK_IDS = Object.keys(SKILL_BOOKS) as SkillBookId[];
