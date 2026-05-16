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
  /** 1~2 문장 줄거리. 미완료/예정 챕터는 숨기고 완료 후 공개. */
  summary: string;
  /**
   * 완료 후에만 노출되는 1~2 단락 회고문. 챕터의 분위기·세계관 떡밥을 시 한 편 분량으로
   * 적어두는 자리. 빈 챕터는 회고 없이 summary 만 보임.
   */
  memory?: string;
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
    memory:
      "산적은 한낱 도적이 아니었다. 그들의 야영지는 동굴 입구에서 한참 멀어진 위치였고, 무엇이 그들을 그곳까지 밀어냈는지 아무도 말하지 않으려 했다.\n동굴 안쪽에서 새어 나오는 차가운 공기 — 광맥의 한기가 아니라 더 깊은, 더 오래된 무엇의 숨결이었다.",
    rule: { kind: "questCompleted", questId: "village-jimmy-bandits" },
  },
  {
    number: 2,
    act: 1,
    title: "깊은 동굴",
    summary:
      "광맥의 수호자를 처치하고 동굴 안쪽의 첫 단서를 본다. 어딘가의 옛 비문에 새겨진 별의 인장.",
    memory:
      "수호자의 갑주는 광물이 아니었다. 그것은 별빛이 굳어 만들어진 것 — 들어본 적도 없는 금속의 빛.\n갱도 가장 깊은 바위벽에 새겨진 인장: 여섯 갈래의 별 안에 손바닥이 그려져 있었다. 사람의 손이 아니라, 무엇을 누르고 있는 손.",
    rule: { kind: "questCompleted", questId: "village-jimmy-deep-cave" },
  },
  {
    number: 3,
    act: 1,
    title: "디올라의 후드 손님",
    summary:
      "안개 호수 너머 디올라에서 만난 후드 손님이 옛 폐허를 가리킨다. \"봉인은 셋, 길은 북으로\".",
    memory:
      "후드 손님은 디올라의 주민이 아니었다. 그는 처음부터 내가 올 것을 안다는 듯이 말했다 — *\"세 개의 봉인이 풀리는 자리가 있다. 길은 북으로\"*.\n그가 들고 있던 잔에는 별 모양의 무늬가 음각되어 있었다. 깊은 동굴의 바위벽에서 본 것과 같은 모양.",
    rule: { kind: "storyFlag", flagId: "stranger_ruins_guide" },
  },
  {
    number: 4,
    act: 1,
    title: "영혼 결정",
    summary:
      "디올라 촌장 마린의 청 — 영혼 결정 수집을 도우며 폐허의 비문 조각을 더 모은다.",
    memory:
      "폐허의 영혼 결정은 빛이 아니라 *기억* 을 담고 있었다. 손에 쥐면 보이지 않는 것들이 떠올랐다 — 무너진 첨탑, 별이 떨어지던 하늘, 누군가가 옥좌에 앉으며 별빛을 거두어들이던 장면.\n그것이 무엇의 기억인지는 모른다. 다만 그 기억은 내 것이 아니었음에도 — 어딘가 익숙했다.",
    rule: { kind: "questCompleted", questId: "diola-marin-soul-crystals" },
  },
  {
    number: 5,
    act: 1,
    title: "산정으로 가는 길",
    summary:
      "마린의 산정 거래 의뢰가 풀리며 북쪽 산정 라인이 열린다. 비문의 마지막 조각: 옛 천공인 황제의 이름.",
    memory:
      "폐허의 비문에서 마지막 조각을 맞췄을 때 — 한 이름이 떠올랐다. 사람의 이름이 아니라, 사람이 한때 부르던 이름. *옥좌의 주재.*\n마린은 그 이름을 듣자마자 잔을 떨어뜨렸다. \"그 이름은… 부르면 안 되는 거였소.\" 그러나 이미 부른 뒤였다. 북쪽으로 가는 길이 열렸고, 무언가가 내 등 뒤에서 깨어났다.",
    rule: { kind: "questCompleted", questId: "diola-marin-mountain-trade" },
  },
  // ── 2막 — 세 봉인 (Ch 6~12) ──────────────────────────────────────────────
  {
    number: 6,
    act: 2,
    title: "산이 깨어나는 소리",
    summary:
      "북풍 산기슭 노촌장 백운이 협곡의 거인을 경계한다. 정찰 의뢰부터.",
    memory:
      "절벽 늑대들이 협곡 너머로 떼지어 도망치고 있었다. 산정의 짐승들은 도망갈 줄 모르는 것이 정상이다 — 그곳이 그들의 자리이기 때문에.\n백운이 낮은 목소리로 말했다: \"산이 깨어나는 소리는 천 년에 한 번이오. 마지막으로 들었을 때, 우리 마을은 절반이 사라졌소.\"",
    rule: { kind: "questCompleted", questId: "unhyang-baekun-canyon-survey" },
  },
  {
    number: 7,
    act: 2,
    title: "운봉의 거인 — 첫 봉인",
    summary:
      "거인을 잠재운다. 백운: \"막은 게 아니라 재워 둔 것\". 첫 봉인이 풀렸다.",
    memory:
      "거인은 포효하지 않았다. 그것은 *신음* 했다 — 깨어나기 싫다는 듯, 잠을 방해받은 자의 한숨처럼.\n그것이 쓰러진 자리에서 협곡의 바람이 한 방향으로만 흘렀다. 북쪽으로. 마치 무언가가 거인의 마지막 숨을 받아 가는 것처럼. 백운은 그날 밤 술잔을 들지 않았다.",
    rule: { kind: "storyFlag", flagId: "peak_giant_defeated" },
  },
  {
    number: 8,
    act: 2,
    title: "운봉 네 자루",
    summary:
      "대장장이 만월의 운봉석 네 자루 제작. 그 자리에서 만난 순례자 미상 — 북쪽 더 깊은 곳에서 왔다.",
    memory:
      "운향의 대장간 한구석에 앉아 있던 그 사람은 — 후드를 벗지 않았다. 만월이 \"어디서 왔소?\" 라고 물을 때마다 그는 다른 곳을 가리켰다.\n그가 내게 말했다: \"북쪽에 가야 할 일이 있다면, 내가 도울 수 있다.\" 도움이라는 단어가 그의 입에서 나올 때 — 어딘가 익숙한 울림이 있었다. 디올라의 후드 손님과 같은 톤이었다.",
    rule: { kind: "questCompleted", questId: "unhyang-manwol-weapons" },
  },
  {
    number: 9,
    act: 2,
    title: "소만의 신임",
    summary:
      "소만 원로 여울의 신임을 얻는다. 갈매의 통발 부탁을 받고 갯벌 길을 익힘.",
    memory:
      "여울이 늙은 어부의 이야기를 들려주었다 — \"옛적엔 바다 깊은 곳에서 무언가가 우리에게 길을 알려주곤 했소. 별이 안 보이는 날에도 배는 길을 잃지 않았지.\"\n\"언제부터 사라졌소?\" 라고 묻자 그가 답했다 — \"누군가가 그것을 가두고 난 뒤요. 그러고 나서 우리는 별을 다시 잃었지.\"",
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
    memory:
      "수심의 것은 마지막 순간 사람의 눈을 하고 있었다. 두려움도 노여움도 아닌 — 안도의 눈빛.\n그것이 사라진 후 호수의 물이 맑아졌다. 하지만 그 맑음은 정화가 아니었다. 무언가가 *빠져나간* 자리의 비어 있음. 여울은 그날 이후 바다를 쳐다보지 않았다.",
    rule: { kind: "storyFlag", flagId: "the_deep_one_stilled" },
  },
  {
    number: 11,
    act: 2,
    title: "옛 변경 성채",
    summary:
      "마른나루 무진의 회고 — \"한 세대 전, 하늘에서 침공이 왔다\". 옛길을 정리하며 성채로.",
    memory:
      "무진은 오래된 일지를 펼쳤다. 한 세대 전의 기록 — \"별이 떨어졌는데, 떨어진 게 아니라 *걸어 내려왔다*. 우리 셋이 성채로 들어갔고, 나만 돌아왔소.\"\n그가 말끝을 흐렸다: \"성문지기는 그때부터 거기 서 있소. 누가 만든 게 아니라 — 그때 *남겨진* 거지.\"",
    rule: { kind: "questCompleted", questId: "dustford-mujin-clear-road" },
  },
  {
    number: 12,
    act: 2,
    title: "옛 성문지기 — 세 번째 봉인",
    summary:
      "성문지기 자동인형을 격파. 세 번째 봉인. \"봉인이 풀리는 날, 별이 돌아오리\" — 바람골 음유시.",
    memory:
      "성문지기가 쓰러진 자리에서 옛 군기 한 점을 찾았다. 그 위에 새겨진 이름 — 디올라 폐허의 비문에서 본 그 이름과 같았다. *옥좌의 주재.*\n바람골의 술집에서 누군가가 부르는 옛 노래가 들렸다 — *세 봉인이 풀리는 날, 별이 돌아오리.* 노래의 끝구절은 술집 안 누구도 부르지 않았다. 그 구절은 잊혀진 것이 아니라 — *잊으려고* 한 것이었다.",
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
