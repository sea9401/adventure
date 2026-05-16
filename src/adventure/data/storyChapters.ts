// 메인 스토리 「옥좌의 부름」 — 25챕터, 4막.
//
// 컨셉: 옛 천공인 마지막 황제(시호 "옥좌의 주재") 가 봉인된 자들의 힘을 회수하려 한다.
// 거인·수심의 것·성문지기·노룡은 황제의 분리된 힘 조각. 운향의 순례자가 황제의 분신.
// 플레이어는 영웅인 줄 알고 봉인을 풀어주다가 후반에 자신이 빌런의 도구였음을 깨닫고
// 황제 본체(창공의 옥좌 협동 보스)와 최종 대결한다.
//
// PR-3a (이 파일) — 챕터 인프라만. 각 챕터의 메타데이터 + 완료 조건을 기존 storyFlag /
// 퀘스트 / 지역 방문에 매핑. 후속 PR(3b/3c/3d)에서 새 대사·NPC·플래그를 채우면서
// `tbd: true` 인 챕터들이 활성화된다.

import type { RegionId } from "./world";

export type ChapterCompletionRule =
  | { kind: "storyFlag"; flagId: string }
  | { kind: "questCompleted"; questId: string }
  | { kind: "regionVisited"; regionId: RegionId }
  | { kind: "allOf"; rules: readonly ChapterCompletionRule[] }
  // PR-3a 시점에 구현 불가 — 후속 PR 에서 새 플래그/대사 추가되면 교체.
  // UI 는 "준비 중" 으로 표시. 진행 흐름 막지 않음 (current 챕터 산출 시 skip).
  | { kind: "tbd" };

export type StoryChapter = {
  /** 1~25 — 정수 순서. UI 정렬 키. */
  number: number;
  /** 1~4 — 막. UI 그룹화. */
  act: 1 | 2 | 3 | 4;
  /** 짧은 챕터 제목. */
  title: string;
  /** 1~2 문장 줄거리. */
  summary: string;
  /** 완료 판정 규칙. */
  rule: ChapterCompletionRule;
};

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  // ── 1막 — 평범한 모험가 (Ch 1~5) ─────────────────────────────────────────
  {
    number: 1,
    act: 1,
    title: "동굴 입구의 무언가",
    summary:
      "시작 마을의 나무꾼 지미가 산적과 동굴 안쪽에서 본 무언가를 걱정한다. 우선 옛길의 산적부터.",
    rule: { kind: "questCompleted", questId: "village-jimmy-bandits" },
  },
  {
    number: 2,
    act: 1,
    title: "깊은 동굴",
    summary:
      "광맥의 수호자를 처치하고 동굴 안쪽의 첫 단서를 본다. 어딘가의 옛 비문에 새겨진 별의 인장.",
    rule: { kind: "questCompleted", questId: "village-jimmy-deep-cave" },
  },
  {
    number: 3,
    act: 1,
    title: "디올라의 후드 손님",
    summary:
      "안개 호수 너머 디올라에서 만난 후드 손님이 옛 폐허를 가리킨다. \"봉인은 셋, 길은 북으로\".",
    rule: { kind: "storyFlag", flagId: "stranger_ruins_guide" },
  },
  {
    number: 4,
    act: 1,
    title: "영혼 결정",
    summary:
      "디올라 촌장 마린의 청 — 영혼 결정 수집을 도우며 폐허의 비문 조각을 더 모은다.",
    rule: { kind: "questCompleted", questId: "diola-marin-soul-crystals" },
  },
  {
    number: 5,
    act: 1,
    title: "산정으로 가는 길",
    summary:
      "마린의 산정 거래 의뢰가 풀리며 북쪽 산정 라인이 열린다. 비문의 마지막 조각: 옛 천공인 황제의 이름.",
    rule: { kind: "questCompleted", questId: "diola-marin-mountain-trade" },
  },
  // ── 2막 — 세 봉인 (Ch 6~12) ──────────────────────────────────────────────
  {
    number: 6,
    act: 2,
    title: "산이 깨어나는 소리",
    summary:
      "북풍 산기슭 노촌장 백운이 협곡의 거인을 경계한다. 정찰 의뢰부터.",
    rule: { kind: "questCompleted", questId: "unhyang-baekun-canyon-survey" },
  },
  {
    number: 7,
    act: 2,
    title: "운봉의 거인 — 첫 봉인",
    summary:
      "거인을 잠재운다. 백운: \"막은 게 아니라 재워 둔 것\". 첫 봉인이 풀렸다.",
    rule: { kind: "storyFlag", flagId: "peak_giant_defeated" },
  },
  {
    number: 8,
    act: 2,
    title: "운봉 네 자루",
    summary:
      "대장장이 만월의 운봉석 네 자루 제작. 그 자리에서 만난 순례자 미상 — 북쪽 더 깊은 곳에서 왔다.",
    rule: { kind: "questCompleted", questId: "unhyang-manwol-weapons" },
  },
  {
    number: 9,
    act: 2,
    title: "소만의 신임",
    summary:
      "소만 원로 여울의 신임을 얻는다. 갈매의 통발 부탁을 받고 갯벌 길을 익힘.",
    rule: {
      kind: "allOf",
      rules: [
        { kind: "questCompleted", questId: "saltmarsh-yeoul-reef-survey" },
        { kind: "questCompleted", questId: "saltmarsh-galmae-crabs" },
      ],
    },
  },
  {
    number: 10,
    act: 2,
    title: "수심의 것 — 두 번째 봉인",
    summary:
      "산호초 섬의 수심의 것을 잠재운다. 옛 전승: \"수심의 것은 본래 길잡이였다\".",
    rule: { kind: "storyFlag", flagId: "the_deep_one_stilled" },
  },
  {
    number: 11,
    act: 2,
    title: "옛 변경 성채",
    summary:
      "마른나루 무진의 회고 — \"한 세대 전, 하늘에서 침공이 왔다\". 옛길을 정리하며 성채로.",
    rule: { kind: "questCompleted", questId: "dustford-mujin-clear-road" },
  },
  {
    number: 12,
    act: 2,
    title: "옛 성문지기 — 세 번째 봉인",
    summary:
      "성문지기 자동인형을 격파. 세 번째 봉인. \"봉인이 풀리는 날, 별이 돌아오리\" — 바람골 음유시.",
    rule: { kind: "storyFlag", flagId: "gatekeeper_felled" },
  },
  // ── 3막 — 노룡의 유언 (Ch 13~18) ─────────────────────────────────────────
  {
    number: 13,
    act: 3,
    title: "바람골의 음유시",
    summary:
      "잿빛 협로 너머로 가기 전 바람골 역참. 길잡이 한솔의 봉황령 첫 발 의뢰.",
    rule: { kind: "questCompleted", questId: "windvale-pathfinder-ridge-scout" },
  },
  {
    number: 14,
    act: 3,
    title: "용비늘 묘지",
    summary:
      "용비늘 묘지의 뼈비늘 노룡을 처치한다. 비문에 황제의 이름이 새겨져 있다.",
    rule: { kind: "storyFlag", flagId: "wyrm_warden_felled" },
  },
  {
    number: 15,
    act: 3,
    title: "태고의 노룡 — 유언",
    summary:
      "어미 노룡과의 협동전. 마지막 유언: \"황제가… 부른다\".",
    rule: { kind: "storyFlag", flagId: "primordial_dragon_felled" },
  },
  {
    number: 16,
    act: 3,
    title: "화산의 심장",
    summary:
      "잿빛 협로 → 봉황령 → 화산 지대. 화산의 심장을 잠재워야 천공 성지가 열린다.",
    rule: { kind: "storyFlag", flagId: "volcano_heart_defeated" },
  },
  {
    number: 17,
    act: 3,
    title: "천공인 멸망의 진실",
    summary:
      "원로 해무와 사미승 운하 — 천공인 문명은 황제 한 사람이 모든 별빛을 삼키며 멸망했다.",
    rule: { kind: "storyFlag", flagId: "skyreach_main_cleared" },
  },
  {
    number: 18,
    act: 3,
    title: "순례자의 정체",
    summary:
      "순례자 미상은 옛 황제의 분신이었다. 플레이어가 푼 봉인은 모두 황제로 회수된 것.",
    // PR-3c 에서 폭로 컷씬 + 새 storyFlag 추가 시 교체.
    rule: { kind: "tbd" },
  },
  // ── 4막 — 옥좌의 길 (Ch 19~25) ───────────────────────────────────────────
  {
    number: 19,
    act: 4,
    title: "별의 첨탑",
    summary:
      "별점술사 잔영들의 단편 기억 — 황제의 봉인 의식을 거꾸로 본다. 별의 수호자가 잠든 곳.",
    rule: { kind: "regionVisited", regionId: "starspire" },
  },
  {
    number: 20,
    act: 4,
    title: "별을 지키는 자",
    summary:
      "별바다 노수호자 유성의 회랑 봉인 의뢰. 별을 지키는 자가 자유로워진다 — \"우릴 끊어 다오\".",
    rule: { kind: "storyFlag", flagId: "starspire_keeper_defeated" },
  },
  {
    number: 21,
    act: 4,
    title: "별바다의 유성",
    summary:
      "유성의 진실 — 마지막 천공인 후예. 봉인을 지키려 했지만 이미 늦었다.",
    rule: { kind: "regionVisited", regionId: "star_haven" },
  },
  {
    number: 22,
    act: 4,
    title: "천공인의 왕",
    summary:
      "선인의 폐도 깊은 곳, 천공인의 왕을 봉인 해제한다. 황제는 약해지고, 동시에 더 가까워진다.",
    rule: { kind: "storyFlag", flagId: "skyfolk_king_defeated" },
  },
  {
    number: 23,
    act: 4,
    title: "옥좌의 길 — 분신과의 결판",
    summary:
      "옥좌의 길에서 순례자 미상(황제 분신) 과 단독전. 옥좌가 가까이서 보인다.",
    // PR-3d 에서 분신 보스 + 단독전 시퀀스 + flag 추가 시 교체.
    rule: { kind: "tbd" },
  },
  {
    number: 24,
    act: 4,
    title: "옥좌의 검신",
    summary:
      "별바다 유성의 마지막 의뢰 — 옥좌 둘레의 별빛 사도 봉인 해제. 황제의 마지막 갑주가 벗겨진다.",
    rule: { kind: "storyFlag", flagId: "apex_gate_cleared" },
  },
  {
    number: 25,
    act: 4,
    title: "옥좌의 주재",
    summary:
      "창공의 옥좌 협동 최종전 — 황제 본체. 옥좌를 다시 봉인할 것인가, 그 자리에 앉을 것인가.",
    rule: { kind: "storyFlag", flagId: "endgame_apex_defeated" },
  },
];

// ── 평가 ────────────────────────────────────────────────────────────────────

export type ChapterEvalDeps = {
  hasFlag: (flagId: string) => boolean;
  isQuestCompleted: (questId: string) => boolean;
  hasVisitedRegion: (regionId: RegionId) => boolean;
};

export function evaluateChapterRule(
  rule: ChapterCompletionRule,
  deps: ChapterEvalDeps,
): boolean {
  switch (rule.kind) {
    case "storyFlag":
      return deps.hasFlag(rule.flagId);
    case "questCompleted":
      return deps.isQuestCompleted(rule.questId);
    case "regionVisited":
      return deps.hasVisitedRegion(rule.regionId);
    case "allOf":
      return rule.rules.every((r) => evaluateChapterRule(r, deps));
    case "tbd":
      return false;
  }
}

export function isChapterTbd(rule: ChapterCompletionRule): boolean {
  if (rule.kind === "tbd") return true;
  if (rule.kind === "allOf") return rule.rules.some(isChapterTbd);
  return false;
}
