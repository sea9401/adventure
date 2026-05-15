// 메뉴얼 섹션 메타데이터. 슬러그 ↔ 제목/요약/그룹.
// 본문은 별도 컴포넌트 파일(content/<slug>.tsx)로 분리해 정적 사이즈 부담을 줄인다.

export type ManualGroup = "intro" | "combat" | "growth" | "world" | "endgame";

export type ManualSection = {
  slug: string;
  title: string;
  summary: string;
  group: ManualGroup;
};

export const MANUAL_GROUP_LABEL: Record<ManualGroup, string> = {
  intro: "시작하기",
  combat: "전투",
  growth: "성장",
  world: "세계",
  endgame: "엔드게임",
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    slug: "overview",
    title: "게임 개요",
    summary: "이 게임이 어떤 게임인지, 무엇을 목표로 하는지.",
    group: "intro",
  },
  {
    slug: "controls",
    title: "화면 구성과 조작",
    summary: "헤더·탭·서브뷰가 어떻게 짜여 있는지.",
    group: "intro",
  },
  {
    slug: "combat",
    title: "전투 시스템",
    summary: "턴 흐름, 데미지 계산, 회피·크리·반격 — 전투의 모든 것.",
    group: "combat",
  },
  {
    slug: "stats",
    title: "스탯과 환산",
    summary: "5대 스탯이 실제 전투 수치로 어떻게 환산되는지.",
    group: "growth",
  },
  {
    slug: "skills",
    title: "스킬과 특기",
    summary: "스탯 임계에서 풀리는 스킬·특기, 슬롯 해금 조건.",
    group: "growth",
  },
  {
    slug: "leveling",
    title: "레벨과 경험치",
    summary: "EXP 곡선, 신참 보너스, 만렙 100 까지의 구간별 가팔라짐.",
    group: "growth",
  },
  {
    slug: "equipment",
    title: "장비",
    summary: "무기·방어구·장신구, 티어, 장비 검색.",
    group: "growth",
  },
  {
    slug: "runes",
    title: "룬",
    summary: "룬 10종 × 5등급, 합성, 효과 합산 규칙.",
    group: "growth",
  },
  {
    slug: "potions",
    title: "포션과 자동 포션",
    summary: "회복량 공식, 보유 상한, 자동 발동 규칙.",
    group: "combat",
  },
  {
    slug: "hunting",
    title: "사냥과 자동 사냥",
    summary: "라이브 사냥 vs 위탁 원정. 효율·캡·부활.",
    group: "combat",
  },
  {
    slug: "town",
    title: "마을과 시설",
    summary: "치유소·상점·제작소·훈련장·길드.",
    group: "world",
  },
  {
    slug: "quests",
    title: "의뢰와 길드",
    summary: "길드 게시판, NPC 의뢰, 반복 쿨다운.",
    group: "world",
  },
  {
    slug: "compendium",
    title: "모험의 서 (도감)",
    summary: "몬스터·NPC·장소가 어떻게 드러나는지.",
    group: "world",
  },
  {
    slug: "tower",
    title: "고탑",
    summary: "솔로 무한 탑, 스케일링 공식, 마일스톤.",
    group: "endgame",
  },
];

export const MANUAL_SLUGS = MANUAL_SECTIONS.map((s) => s.slug);

export function getSection(slug: string): ManualSection | null {
  return MANUAL_SECTIONS.find((s) => s.slug === slug) ?? null;
}

export const DEFAULT_MANUAL_SLUG = MANUAL_SECTIONS[0]?.slug ?? "overview";
