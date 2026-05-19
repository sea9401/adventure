import type { ItemId } from "./items";
import type { MaterialId } from "./materials";
import type { NpcId } from "./npcs";
import type { PotionId } from "./potions";
import type { RegionId } from "./world";
import type { SkillBookId } from "./skillBooks";

export type QuestRewardItem = { id: ItemId; count: number };
export type QuestRewardPotion = { id: PotionId; count: number };
export type QuestRewardMaterial = { id: MaterialId; count: number };

export type QuestReward = {
  gold?: number;
  fame?: number;
  exp?: number;
  potions?: QuestRewardPotion[];
  materials?: QuestRewardMaterial[];
  items?: QuestRewardItem[];
  recipes?: string[];
  // 종류별 포션 최대 보유 수의 영구 보너스(+n).
  potionCapacityBonus?: number;
  // 학습 전 AP 스킬북 — 보상 회수 시 인벤토리에 1권씩 들어간다.
  skillBooks?: SkillBookId[];
};

// 의뢰 목표 — 8 종류:
// - "kill"             : 지정 몬스터를 N마리 처치. 진행도는 storage 의 progress 에 누적.
// - "deliver"          : 지정 재료를 N개 모아 의뢰주(NPC)에게 직접 건넨다. 진행도는 별도
//                        저장하지 않고, NPC 대화에서 인벤토리 잔량을 보고 즉시 판정·소비한다.
// - "talk_to_npc"      : 지정 NPC 와 N번 대화. 대화창 닫힐 때(TownSubView.onTalkClose) 누적.
// - "visit_region"     : 지정 지역에 N번 입장. 지역 이동 성공 시(page.tsx region 효과) 누적.
// - "craft_item"       : 지정 장비를 N개 제작. 제작 성공 시(useCraftAction) 누적.
// - "equip_item"       : 지정 장비를 한 번이라도 장착. 장착 슬롯 변경 감지(page.tsx checkEquip) 시
//                        조건 충족 시점에 즉시 ready 로 전환. progress 는 0 또는 1.
// - "equip_set"        : 지정 장비 N종을 동시에 장착. progress = 현재 동시 장착 중인 수.
// - "kill_within_hp"   : 지정 몬스터를 처치 시점 HP 가 maxHp×minHpFraction 이상으로 N번 처치.
//                        조건 미달 처치는 진행도 증가 없음 (보스 도전 의뢰 — 엄격한 처치).
// - "no_potion_boss"   : 지정 몬스터를 그 전투에서 포션 0병 사용으로 N번 처치.
export type QuestTarget =
  | { kind: "kill"; monsterName: string; count: number }
  | { kind: "deliver"; materialId: MaterialId; count: number }
  | { kind: "talk_to_npc"; npcId: NpcId; count?: number }
  | { kind: "visit_region"; regionId: RegionId; count?: number }
  | { kind: "craft_item"; itemId: ItemId; count: number }
  | { kind: "equip_item"; itemId: ItemId }
  | { kind: "equip_set"; itemIds: ItemId[] }
  | { kind: "kill_within_hp"; monsterName: string; minHpFraction: number; count: number }
  | { kind: "no_potion_boss"; monsterName: string; count: number };

// 의뢰 목표가 요구하는 총량 — UI 와 useQuests 가 공용으로 쓴다.
// count 가 없는 kind 는 1 (talk/visit 기본), equip_item 도 1, equip_set 은 itemIds.length.
export function questTargetTotal(t: QuestTarget): number {
  switch (t.kind) {
    case "kill":
    case "deliver":
    case "craft_item":
    case "kill_within_hp":
    case "no_potion_boss":
      return t.count;
    case "talk_to_npc":
    case "visit_region":
      return t.count ?? 1;
    case "equip_item":
      return 1;
    case "equip_set":
      return t.itemIds.length;
  }
}

// 행정 패널/덤프용 짧은 요약 문자열. (UI 의 사용자용 설명은 QuestJournalView 의 TargetView 가 그린다.)
export function questTargetSummary(t: QuestTarget): string {
  switch (t.kind) {
    case "kill":
      return `${t.monsterName} ×${t.count}`;
    case "kill_within_hp":
      return `${t.monsterName} ×${t.count} (HP ${Math.round(t.minHpFraction * 100)}%↑)`;
    case "no_potion_boss":
      return `${t.monsterName} ×${t.count} (포션 X)`;
    case "deliver":
      return `${t.materialId} ×${t.count}`;
    case "talk_to_npc":
      return `${t.npcId} 대화 ×${t.count ?? 1}`;
    case "visit_region":
      return `${t.regionId} 방문 ×${t.count ?? 1}`;
    case "craft_item":
      return `${t.itemId} 제작 ×${t.count}`;
    case "equip_item":
      return `${t.itemId} 장착`;
    case "equip_set":
      return `한 복 장착 (${t.itemIds.length}종)`;
  }
}

export type Quest = {
  id: string;
  regionId: RegionId;
  title: string;
  description: string;
  requiredLevel: number;
  target: QuestTarget;
  reward: QuestReward;
  repeatable: boolean;
  // 반복 의뢰의 재수주 쿨다운(ms). 미지정 시 REPEAT_COOLDOWN_MS_DEFAULT.
  // repeatable=false 인 경우 의미 없음.
  cooldownMs?: number;
  // 설정 시 길드 게시판에 노출되지 않고 해당 NPC 대화에서만 진행.
  giverNpcId?: NpcId;
  // 설정 시 지정된 의뢰가 'completed' 상태일 때만 게시판/UI 에 노출.
  // 메인 라인을 끝낸 모험가에게만 풀리는 후속 반복 의뢰 등에 사용.
  requiresQuestCompleted?: string;
  // 발견형 의뢰 — 인벤/플래그/특수 조건이 다이얼로그에서 게이트하는 케이스.
  // 데이터로 게이트를 표현할 수 없어 NPC 뱃지("!") 가 스포일하지 않도록 통째로 제외.
  // 플레이어가 직접 NPC 와 대화해 발견해야 함.
  hidden?: boolean;
};

export const REPEAT_COOLDOWN_MS_DEFAULT = 6 * 60 * 60 * 1000;

const H = 60 * 60 * 1000;
// 지역별 반복 의뢰 기본 쿨다운. 우선순위: quest.cooldownMs > 이 맵 > REPEAT_COOLDOWN_MS_DEFAULT.
// 초반 마을은 짧게(빌드/명성/골드 빨리), 후반 지역은 길게(반복 효율 억제).
export const REGION_REPEAT_COOLDOWN_MS: Partial<Record<RegionId, number>> = {
  village: 3 * H,
  dustford: 4 * H,
  diola: 6 * H,
  saltmarsh: 7 * H,
  unhyang: 8 * H,
  windvale: 10 * H,
  skyreach: 12 * H,
};

export const QUESTS: Quest[] = [
  {
    id: "village-beggars",
    regionId: "village",
    title: "마을의 거지들",
    description:
      "마을에 주정뱅이가 너무 많다는 민원이 들어오고있어요. 주정뱅이 30명을 혼내주세요.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"주정뱅이", count: 30 },
    reward: { gold: 45, fame: 3, exp: 35 },
    repeatable: true,
  },
  {
    id: "village-slime-extermination",
    regionId: "village",
    title: "슬라임 퇴치",
    description:
      "평야에 슬라임이 갑자기 너무 많아져서 농부들이 피해를 보고있어요. 슬라임 60마리를 처치해주세요.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"슬라임", count: 60 },
    reward: { gold: 60, fame: 4, exp: 120 },
    repeatable: true,
  },
  {
    id: "village-dog-extermination",
    regionId: "village",
    title: "들개 퇴치",
    description:
      "마을 외곽에서 들개가 가축을 노린다는 신고가 들어왔어요. 들개 45마리를 처치해주세요.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"들개", count: 45 },
    reward: { gold: 70, fame: 4, exp: 135 },
    repeatable: true,
  },
  {
    id: "village-mole-extermination",
    regionId: "village",
    title: "두더지 퇴치",
    description:
      "두더지가 밭을 헤집어 놓아 농작물 피해가 심해요. 두더지 60마리를 처치해주세요.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"두더지", count: 60 },
    reward: { gold: 55, fame: 4, exp: 120 },
    repeatable: true,
  },
  {
    id: "village-trainer-slimes",
    regionId: "village",
    title: "훈련: 슬라임 5마리",
    description: "훈련 교관 스미스의 첫 과제. 평야의 슬라임 5마리를 처치한다.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"슬라임", count: 5 },
    reward: {
      potions: [{ id: "potion_heal_s", count: 5 }],
    },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
  },
  {
    id: "village-trainer-dogs",
    regionId: "village",
    title: "훈련: 들개 10마리",
    description: "훈련 교관 스미스의 두 번째 과제. 들개 10마리를 처치한다.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"들개", count: 10 },
    reward: { exp: 30, gold: 15, fame: 3 },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
    requiresQuestCompleted: "village-trainer-slimes",
  },
  {
    id: "village-trainer-moles",
    regionId: "village",
    title: "훈련: 두더지 10마리",
    description: "훈련 교관 스미스의 마지막 과제. 두더지 10마리를 처치한다.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"두더지", count: 10 },
    reward: {
      items: [{ id: "vitality_ring", count: 1 }],
    },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
    requiresQuestCompleted: "village-trainer-dogs",
  },
  {
    id: "village-jimmy-bandits",
    regionId: "village",
    title: "나무꾼 지미의 부탁",
    description:
      "요즘 숲에 산적이 너무 많이 나와서 벌목하러 가질 못하고있어요. 산적들좀 처리해주세요.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName: "산적", count: 20 },
    reward: {
      items: [{ id: "spare_hatchet", count: 1 }],
      potionCapacityBonus: 1,
    },
    repeatable: false,
    giverNpcId: "village_woodcutter_jimmy",
    // 다이얼로그 게이트: crafting.state.boldQuestComplete. 데이터로 표현 불가 → hidden.
    hidden: true,
  },
  // 지미 — 산적 의뢰 완료 후 받는 깊은 동굴 조사 의뢰. 보스 1회 처치.
  // 수락 시 'jimmy_deep_cave_quest' story flag 설정 → 동굴 → 깊은 동굴 통로 해금.
  {
    id: "village-jimmy-deep-cave",
    regionId: "village",
    title: "동굴 안쪽의 무언가",
    description:
      "요즘 동굴 더 안쪽까지 들어가다가 큰 광맥 하나를 봤는데, 그 너머에서 영 안 좋은 기운이 풍기더라고. 무서워서 도망쳐 나왔어. 모험가 양반이 한 번 가서 무엇이 있는지 확인해 주쇼.",
    requiredLevel: 5,
    target: { kind: "kill", monsterName: "광맥의 수호자", count: 1 },
    reward: { gold: 900, fame: 30, exp: 1050, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "village_woodcutter_jimmy",
    requiresQuestCompleted: "village-jimmy-bandits",
  },
  // 시작 마을 길드판 반복 의뢰 — 메인 깊은 동굴 의뢰 완료 후에만 노출.
  // 보스 일일 3회 제한이라 1일에 1회 완료 가능. 누적 파밍 동기.
  // count 는 일일 캡(3)에 묶여 있어 다른 반복 의뢰처럼 ×3 하지 않고 보상만 키운다.
  {
    id: "village-deep-cave-recurring",
    regionId: "village",
    title: "광맥의 수호자 토벌 ─ 정기",
    description:
      "동굴 안쪽 광맥에서 다시 깨어나는 그놈을 정기적으로 잠재워 주시오. 세 번이면 한동안은 잠잠할 것이오.",
    requiredLevel: 6,
    target: { kind: "kill", monsterName: "광맥의 수호자", count: 3 },
    reward: { gold: 400, fame: 12, exp: 480 },
    repeatable: true,
    requiresQuestCompleted: "village-jimmy-deep-cave",
  },
  // 볼드 — 마정석 무기 라인 보조(§10.1). 광맥의 수호자 드롭(마정석)을 볼드가 시연 → 팔찌 제작서.
  // BlacksmithDialogue 에서 노출 (jimmy_deep_cave_quest flag 가 켜진 뒤 — 동굴 안쪽을 안다는 신호).
  {
    id: "village-bold-mana-crystal",
    regionId: "village",
    title: "마정석을 다루는 법",
    description:
      "광맥의 수호자가 떨군 마정석, 그거 제대로 다루려면 손이 익어야 해. 다섯 덩이만 가져와 봐. 그걸로 시연을 보여주지. 보고 나면 자네도 마정석 무기를 벼릴 수 있을 거야.",
    requiredLevel: 6,
    target: { kind: "deliver", materialId: "mana_crystal", count: 5 },
    reward: { gold: 600, exp: 500, recipes: ["mana_bracelet"], potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "village_blacksmith_bold",
    // 다이얼로그 게이트: storyFlags.has("jimmy_deep_cave_quest"). 데이터로 표현 불가 → hidden.
    hidden: true,
  },
  // ── 시작 마을 — 새 quest kind 의뢰 3종 ─────────────────────────────────
  // 각 인트로 라인의 4 번째 단계로 매단다. 라인 어휘를 잇는 자연스러운 결.
  {
    // equip_item — 트레이너 라인 마무리. 활력의 반지 한 번이라도 차고 와 봐.
    id: "village-trainer-equip-vitality-ring",
    regionId: "village",
    title: "스미스의 청: 반지를 차고 와",
    description:
      "내가 준 활력의 반지. 끼고 다녀? 한 번이라도 차고 와 보게. 그래야 자네가 평야 졸업이라고 인정해 주지.",
    requiredLevel: 1,
    target: { kind: "equip_item", itemId: "vitality_ring" },
    reward: { gold: 60, fame: 5, exp: 90 },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
    requiresQuestCompleted: "village-trainer-moles",
  },
  {
    // visit_region — 지미의 깊은 동굴 라인 마무리. 광맥 자리를 다섯 번 더 봐 두고 와라.
    id: "village-jimmy-deep-cave-tour",
    regionId: "village",
    title: "나무꾼 지미의 청: 광맥 자리 다시 보기",
    description:
      "사람들이 안 믿어요. 자네가 봤다는 그 광맥 자리, 한 번 더 가서 확인하고 와 주쇼. 다섯 번이면 마을 사람들도 자네 말을 믿을 게요.",
    requiredLevel: 6,
    target: { kind: "visit_region", regionId: "deep_cave", count: 5 },
    reward: { gold: 320, fame: 14, exp: 480 },
    repeatable: false,
    giverNpcId: "village_woodcutter_jimmy",
    requiresQuestCompleted: "village-jimmy-deep-cave",
  },
  {
    // craft_item — 볼드의 마정석 라인 마무리. 자네 손으로 한 자루 짜 봐.
    id: "village-bold-mana-sword-craft",
    regionId: "village",
    title: "대장장이 볼드의 청: 자네 손으로 한 자루",
    description:
      "팔찌까지 짜 봤으니, 이젠 칼이야. 마정석 검. 자네 손으로 한 자루 짜 봐. 그래야 그 마정석이 손에 어떻게 익는지 알지.",
    requiredLevel: 7,
    target: { kind: "craft_item", itemId: "mana_sword", count: 1 },
    reward: { gold: 400, fame: 16, exp: 600 },
    repeatable: false,
    giverNpcId: "village_blacksmith_bold",
    requiresQuestCompleted: "village-bold-mana-crystal",
  },
  // ── 디올라 — "안개 너머의 길" 트라이얼 라인 ──────────────────────────────
  // 후드 손님이 폐허로 안내하기 전에 디올라 사람들의 신뢰를 얻어야 한다.
  // 세 의뢰는 마을·동굴·숲을 거쳐 디올라까지 이른 모험가가 그 동선을 다시
  // 한 번 훑게 하는 가벼운 콜백 — 자료 채집형(deliver)으로 진행.
  {
    id: "diola-rio-nails",
    regionId: "diola",
    title: "리오의 수집",
    description:
      "낡은 못을 모은다는 동네 형/누나가 있다더니, 진짜 모험가였구나! 20개만 모아주면 신기한 거 알려줄게.",
    requiredLevel: 1,
    target: { kind: "deliver", materialId: "rusty_nail", count: 20 },
    reward: { potionCapacityBonus: 1, gold: 90, fame: 9 },
    repeatable: false,
    giverNpcId: "diola_kid",
    // 다이얼로그 게이트: storyFlags.has(STRANGER_FLAG_TRIAL_STARTED) → hidden.
    hidden: true,
  },
  {
    id: "diola-nora-bat-eyes",
    regionId: "diola",
    title: "여관 다락의 박쥐",
    description:
      "여관 다락에 박쥐가 자꾸 들어와서 큰일이에요. 잡아서 눈알 10개만 가져다 주시면, 손님이 두고 간 부적을 드릴게요.",
    requiredLevel: 3,
    target: { kind: "deliver", materialId: "bat_eye", count: 10 },
    reward: { gold: 120, fame: 12, exp: 240 },
    repeatable: false,
    giverNpcId: "diola_innkeeper",
    // 다이얼로그 게이트: storyFlags.has(STRANGER_FLAG_TRIAL_STARTED) → hidden.
    hidden: true,
  },
  {
    id: "diola-boro-spider-silk",
    regionId: "diola",
    title: "보로의 거미줄",
    description:
      "거미줄 재고가 자꾸 모자랍니다. 10개만 모아 주시면, 답례로 골드와 명성을 두둑이 드리지요.",
    requiredLevel: 5,
    target: { kind: "deliver", materialId: "spider_silk", count: 10 },
    reward: { gold: 180, fame: 15, exp: 300 },
    repeatable: false,
    giverNpcId: "diola_merchant",
    // 다이얼로그 게이트: storyFlags.has(STRANGER_FLAG_TRIAL_STARTED) → hidden.
    hidden: true,
  },
  // 마린 — 트라이얼 통과 후 폐허가 열리고 나서야 진행 가능 (영혼 결정은 망령 드롭).
  // 완료 시 '디올라의 친구' 칭호를 부여하는 라인의 클로저.
  {
    id: "diola-marin-soul-crystals",
    regionId: "diola",
    title: "촌장의 청: 영혼 결정",
    description:
      "폐허에서 나온 영혼 결정 3개만 가져다주시오. 옛 기록에 따르면, 이 마을과 폐허의 매듭을 푸는 데 그게 필요하다고 했소. …그리고 그 결정으로 칼을 벼리는 법도 적혀 있더군. 도면도 함께 가져가시오.",
    requiredLevel: 9,
    target: { kind: "deliver", materialId: "soul_crystal", count: 3 },
    reward: { gold: 300, fame: 15, exp: 600, recipes: ["soul_blade"] },
    repeatable: false,
    giverNpcId: "diola_elder",
    // 다이얼로그 게이트: storyFlags.has(STRANGER_FLAG_RUINS_GUIDE) → hidden.
    hidden: true,
  },
  // 마린 ↔ 백운 — 산정 교역로 개통(§7.2). 운향 백운 라인의 mountain_trade_open flag 가
  // 켜진 뒤 MarinDialogue 에서 노출. 완료 시 diola_unhyang_trade_done flag → 양 마을 갱신.
  {
    id: "diola-marin-mountain-trade",
    regionId: "diola",
    title: "산정과의 거래",
    description:
      "산정 길이 다시 안전해졌다고 들었소. 그렇다면 거래를 트지. 우리 쪽 길목도 정리가 필요하오. 폐허 어귀 늑대 서른 마리만 솎아 주시오. 그러면 디올라와 운향 사이로 짐수레가 다시 오갈 게요.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "폐허 늑대", count: 30 },
    reward: { gold: 700, fame: 26, exp: 1100, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "diola_elder",
    requiresQuestCompleted: "unhyang-baekun-highland-goats",
    // 다이얼로그 게이트: storyFlags.has("mountain_trade_open") — goats + cliff-wolves
    // 둘 다 완료해야 켜지는데 prereq 는 goats 만 검사하므로 false positive 방지 위해 hidden.
    hidden: true,
  },
  // ── 디올라 길드 게시판 — 반복 의뢰 ────────────────────────────────────
  // 호수·폐허 두 인접 지역의 적을 디올라 거점에서 처리. 폐허 적 3종은 트라이얼
  // 통과 후에야 실제로 잡을 수 있어, 길드판 노출이 트라이얼 동기 강화에도 기여.
  {
    id: "diola-lake-nymph",
    regionId: "diola",
    title: "호숫가의 노랫소리",
    description:
      "안개 너머에서 노랫소리가 짙어지고 있어요. 어부들이 그물을 거두지 못하고 있습니다. 호수 님프 45를 잠재워 주세요.",
    requiredLevel: 7,
    target: { kind: "kill", monsterName: "호수 님프", count: 45 },
    reward: { gold: 180, fame: 10, exp: 380 },
    repeatable: true,
  },
  {
    id: "diola-ruin-wolves",
    regionId: "diola",
    title: "폐허의 야성",
    description:
      "폐허 어귀에서 늑대들이 떼를 지어 마을 쪽으로 내려옵니다. 45마리를 정리해 주세요.",
    requiredLevel: 9,
    target: { kind: "kill", monsterName: "폐허 늑대", count: 45 },
    reward: { gold: 220, fame: 12, exp: 400 },
    repeatable: true,
  },
  {
    id: "diola-wandering-wraiths",
    regionId: "diola",
    title: "떠도는 자들",
    description:
      "안개 짙은 밤마다 폐허에서 새어 나온 망령이 디올라까지 흘러옵니다. 36체를 잠재워 주세요.",
    requiredLevel: 9,
    target: { kind: "kill", monsterName: "떠도는 망령", count: 36 },
    reward: { gold: 230, fame: 13, exp: 400 },
    repeatable: true,
  },
  {
    id: "diola-broken-golems",
    regionId: "diola",
    title: "잊힌 수호자",
    description:
      "폐허를 지키던 골렘들이 깨어나 무너진 돌담을 짓밟고 있습니다. 30체를 부숴 주세요.",
    requiredLevel: 9,
    target: { kind: "kill", monsterName: "부서진 골렘", count: 30 },
    reward: { gold: 280, fame: 14, exp: 380 },
    repeatable: true,
  },
  // ── 디올라 — 새 quest kind 의뢰 5종 ─────────────────────────────────────
  // 트라이얼 통과 후 라인을 한 번씩 마친 NPC 들이 각자 결에 맞춰 한 단계 더 내준다.
  {
    // talk_to_npc — 리오의 라인 마무리. 어부 카이를 세 번 들러줘라.
    id: "diola-rio-listen-kai",
    regionId: "diola",
    title: "리오의 청: 카이 아저씨한테 가 줘",
    description:
      "카이 아저씨가 요즘 밤마다 호숫가만 봐요. 새벽에도. 엄마가 가서 한번 들어주랬는데. 나 무서워. 형/누나가 세 번만 들러줘요. 진짜로!",
    requiredLevel: 5,
    target: { kind: "talk_to_npc", npcId: "diola_fisher", count: 3 },
    reward: { gold: 140, fame: 9, exp: 220 },
    repeatable: false,
    giverNpcId: "diola_kid",
    requiresQuestCompleted: "diola-rio-nails",
  },
  {
    // talk_to_npc — 노라의 라인 마무리. 리오를 세 번 들러줘라.
    id: "diola-nora-listen-rio",
    regionId: "diola",
    title: "노라의 청: 리오 들어주기",
    description:
      "리오가 요즘 다 큰 척만 해요. 후드 손님 흉내 내면서요. 어린애가 어른 흉내 내는 게 마음 쓰여서요. 형/누나가 세 번만 들러줘요. 차 한 잔 끓여 둘게요.",
    requiredLevel: 5,
    target: { kind: "talk_to_npc", npcId: "diola_kid", count: 3 },
    reward: { gold: 160, fame: 10, exp: 240, potions: [{ id: "potion_heal_s", count: 4 }] },
    repeatable: false,
    giverNpcId: "diola_innkeeper",
    requiresQuestCompleted: "diola-nora-bat-eyes",
  },
  {
    // equip_item — 보로의 라인 마무리. 산적 단검 한 번이라도 차고 와라.
    id: "diola-boro-bandit-dagger-bear",
    regionId: "diola",
    title: "보로의 청: 손에 자루를",
    description:
      "다음에 거래소에 오실 땐. 산적 단검 한 자루라도 차고 와 주세요. 다른 손님이 그 모습을 보면 따라 거래하거든요. 거래는 양쪽이 다 좋아야 거래라잖아요?",
    requiredLevel: 6,
    target: { kind: "equip_item", itemId: "bandit_dagger" },
    reward: { gold: 220, fame: 12, exp: 320 },
    repeatable: false,
    giverNpcId: "diola_merchant",
    requiresQuestCompleted: "diola-boro-spider-silk",
  },
  {
    // kill_within_hp — 카이가 마지막에 내주는 일상 도전. 호수 님프를 흠 없이 다섯.
    // 카이의 결("그 노랫소리에 만져지기 전에 끝내야 해")을 그대로 잇는다.
    id: "diola-kai-pristine-nymphs",
    regionId: "diola",
    title: "카이의 청: 흠 없는 호수 사냥",
    description:
      "그 노랫소리에 만져지기 전에 끝내야 해요. 호수 님프 다섯을. HP 70% 이상으로. 흠 없이 잡고 오세요. 그래야 새벽 그물을 다시 걷을 수 있을 거예요.",
    requiredLevel: 8,
    target: {
      kind: "kill_within_hp",
      monsterName: "호수 님프",
      minHpFraction: 0.7,
      count: 5,
    },
    reward: { gold: 260, fame: 13, exp: 420 },
    repeatable: false,
    giverNpcId: "diola_fisher",
    // 후드 손님이 호수 떡밥을 카이에게 흘린 뒤에야 노출 (Kai 라인 클로저 flag 활용).
    // KaiDialogue 의 lakeHint(KAI_FLAG_LAKE_HINT) 단계까지 진행해야 의뢰가 노출되도록,
    // requiresQuestCompleted 가 아니라 storyFlag 로 게이팅 → hidden.
    hidden: true,
  },
  {
    // equip_set — 마린의 라인 마무리. 자네가 처음 손에 든 것 한 복으로 차고 와라.
    // 시작 장비 3 종(branch_stick·cloth_clothes·mom_amulet)을 동시에 장착하면 진행.
    id: "diola-marin-first-gear-set",
    regionId: "diola",
    title: "촌장의 청: 첫 모험가의 의장",
    description:
      "자네가 처음 손에 든 것. 나뭇가지·천 옷·어머니의 부적. 한 번이라도 다시 한 복으로 차고 와 보게. 우리 마을 사람들도 한 번 봐야 해. 자네가 어디서 시작했는지를.",
    requiredLevel: 10,
    target: {
      kind: "equip_set",
      itemIds: ["branch_stick", "cloth_clothes", "mom_amulet"],
    },
    reward: { gold: 320, fame: 15, exp: 500 },
    repeatable: false,
    giverNpcId: "diola_elder",
    requiresQuestCompleted: "diola-marin-soul-crystals",
  },
  // ── 마른나루 (서편 옛길) ─────────────────────────────────────────────────
  // 옛길(Lv3) 잡몹 의뢰 → 마른나루 신임(무진 보증) → 무진 옛길 정리(oldwall_keep_unsealed)
  // → 옛 변경 성채(Lv13) 정찰 → 옛 성문지기 처치. 두루/나래/솔개는 QuestLineDialogue, 무진은 커스텀.
  // 옛 변경 성채 적을 대상으로 하는 의뢰는 모두 무진의 옛길 정리(clear-road) 완료를 선행으로 둔다.
  {
    id: "dustford-duru-fangs",
    regionId: "dustford",
    title: "두루의 수집: 들고양이 송곳니",
    description:
      "옛길 들고양이가 통발을 헤집어 놓아 큰일이에요. 들고양이 송곳니 10개만 모아 주면 사례하지요. 노상강도 단검 손질하는 법도 알려드릴게요.",
    requiredLevel: 3,
    target: { kind: "deliver", materialId: "wilddog_fang", count: 10 },
    reward: { gold: 80, fame: 7, exp: 130, recipes: ["roadbandit_shortsword"] },
    repeatable: false,
    giverNpcId: "dustford_scavenger",
  },
  {
    id: "dustford-duru-feathers",
    regionId: "dustford",
    title: "두루의 수집: 까마귀 깃",
    description:
      "두건이며 안감이며 까마귀 깃이 자꾸 모자랍니다. 12장만 모아 주면 후하게 쳐드리지요.",
    requiredLevel: 3,
    target: { kind: "deliver", materialId: "raven_feather", count: 12 },
    reward: { gold: 95, fame: 8, exp: 150 },
    repeatable: false,
    giverNpcId: "dustford_scavenger",
  },
  {
    id: "dustford-duru-scrap",
    regionId: "dustford",
    title: "두루의 청: 녹슨 쇳조각",
    description:
      "녹슨 쇳조각은 다시 벼리면 갑옷이고 무기고 다 됩니다. 옛 성채에서 8덩이만 들여와 주면 후하게 쳐드리지요.",
    requiredLevel: 13,
    target: { kind: "deliver", materialId: "scrap_iron", count: 8 },
    reward: { gold: 330, fame: 16, exp: 560 },
    repeatable: false,
    giverNpcId: "dustford_scavenger",
    requiresQuestCompleted: "dustford-mujin-clear-road",
  },
  {
    id: "dustford-narae-feathers",
    regionId: "dustford",
    title: "나래의 베갯속: 까마귀 깃",
    description:
      "손님 베개 속 채울 깃이 영 모자라네요. 까마귀 깃 10장만 들여와 주면 잠자리가 한결 나을 텐데. 손님이 두고 간 회복약도 챙겨 드릴게요.",
    requiredLevel: 3,
    target: { kind: "deliver", materialId: "raven_feather", count: 10 },
    reward: { gold: 75, fame: 6, exp: 120, potions: [{ id: "potion_heal_s", count: 5 }] },
    repeatable: false,
    giverNpcId: "dustford_innkeeper",
  },
  {
    id: "dustford-narae-larder",
    regionId: "dustford",
    title: "나래의 겨우살이",
    description:
      "찬바람 들 철이라 깃을 넉넉히 둬야 해요. 까마귀 깃 15장만 더 들여와 주면. 손님이 두고 간 약 주머니를 손봐서 드릴게요.",
    requiredLevel: 4,
    target: { kind: "deliver", materialId: "raven_feather", count: 15 },
    reward: { gold: 120, fame: 8, exp: 180, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "dustford_innkeeper",
  },
  {
    id: "dustford-narae-keep-stew",
    regionId: "dustford",
    title: "나래의 솥: 탈영 약탈자",
    description:
      "옛 성채에 눌러앉은 탈영병들이 옛길 행상까지 따라붙는대요. 15만 정리해 주면 행상이 다시 다닐 거예요.",
    requiredLevel: 13,
    target: { kind: "kill", monsterName: "탈영 약탈자", count: 15 },
    reward: { gold: 350, fame: 17, exp: 600 },
    repeatable: false,
    giverNpcId: "dustford_innkeeper",
    requiresQuestCompleted: "dustford-mujin-clear-road",
  },
  {
    id: "dustford-solgae-wildcats",
    regionId: "dustford",
    title: "솔개의 사냥: 갈대 살쾡이",
    description:
      "갈대 살쾡이가 둥지를 헤집고 다녀 밭 가는 사람들이 못 살아요. 18마리만 정리해 주면 까마귀깃 두건 짓는 법을 알려드리지요.",
    requiredLevel: 3,
    target: { kind: "kill", monsterName: "갈대 살쾡이", count: 18 },
    reward: { gold: 85, fame: 7, exp: 140, recipes: ["crow_feather_cap"] },
    repeatable: false,
    giverNpcId: "dustford_hunter",
  },
  {
    id: "dustford-solgae-ravens",
    regionId: "dustford",
    title: "솔개의 사냥: 들까마귀 떼",
    description:
      "들까마귀 떼가 옛길 위를 빙빙 돌며 행상 짐을 노립니다. 18마리만 떨어뜨려 주세요.",
    requiredLevel: 3,
    target: { kind: "kill", monsterName: "들까마귀 떼", count: 18 },
    reward: { gold: 90, fame: 7, exp: 140 },
    repeatable: false,
    giverNpcId: "dustford_hunter",
  },
  {
    id: "dustford-mujin-clear-road",
    regionId: "dustford",
    title: "옛길 트기",
    description:
      "옛 성채로 일꾼을 데려가려면 옛길에 눌러앉은 노상강도부터 솎아야 해. 15만 정리해 주게. 그러면 무너진 북쪽 벽으로 가는 길을 열고, 자네도 데려가지.",
    requiredLevel: 7,
    target: { kind: "kill", monsterName: "노상강도", count: 15 },
    reward: { gold: 220, fame: 12, exp: 380 },
    repeatable: false,
    giverNpcId: "dustford_keeper",
    // 다이얼로그 게이트: storyFlags.has(DUSTFORD_FLAG_VOUCHED) → hidden.
    hidden: true,
  },
  {
    id: "dustford-mujin-keep-survey",
    regionId: "dustford",
    title: "무진의 청: 성채 살피기",
    description:
      "성채에 일꾼들을 데리고 들어가 봤네. 다만 안에 녹슨 쇳조각이 얼마나 쌓였는지 봐 와 주게. 10덩이면 재건에 쓸 만한지 알 수 있소.",
    requiredLevel: 12,
    target: { kind: "deliver", materialId: "scrap_iron", count: 10 },
    reward: { gold: 380, fame: 18, exp: 700 },
    repeatable: false,
    giverNpcId: "dustford_keeper",
    requiresQuestCompleted: "dustford-mujin-clear-road",
  },
  {
    id: "dustford-mujin-gatekeeper",
    regionId: "dustford",
    title: "옛 성문지기",
    description:
      "성채는 멀쩡해. 한 가지만 빼면. 성문지기. 사람을 막으라 만든 게 아니야, 군대를 막으라 세운 거지. 군대는 오지 않았고 그것만 남아 빈 벽을 지켜. 단단히 준비해 가서 그것을 잠재워 주게. 마른나루의 명운이 거기 달렸소.",
    requiredLevel: 13,
    target: { kind: "kill", monsterName: "옛 성문지기", count: 1 },
    reward: {
      gold: 700,
      fame: 22,
      exp: 1000,
      potions: [{ id: "potion_heal_s", count: 8 }],
      recipes: ["gatekeeper_core"],
    },
    repeatable: false,
    giverNpcId: "dustford_keeper",
    requiresQuestCompleted: "dustford-mujin-keep-survey",
  },
  {
    id: "dustford-gatekeeper-recurring",
    regionId: "dustford",
    title: "옛 성문지기: 다시 깨어날 때",
    description:
      "한 번 잠재웠다고 끝이 아니야. 또 성문이 깨어나거든. 옛 성문지기를 세 번 더 잠재워 주게. 마른나루가 자네를 잊지 않을 게요.",
    requiredLevel: 13,
    target: { kind: "kill", monsterName: "옛 성문지기", count: 3 },
    reward: { gold: 850, fame: 24, exp: 1200 },
    repeatable: false,
    giverNpcId: "dustford_keeper",
    requiresQuestCompleted: "dustford-mujin-gatekeeper",
  },
  // 옛 성문지기 도전 의뢰 3종 — 보스 처치 후 무진이 추가로 내준다.
  // kill_within_hp / no_potion_boss / equip_set 세 가지 새 quest kind 의 인게임 라인.
  // 단순히 "한 번 처치"가 아니라 자세를 보는 의뢰들 — 옛 수비대의 결을 잇는 자에게.
  {
    id: "dustford-mujin-challenge-pristine",
    regionId: "dustford",
    title: "흠 없는 한 수",
    description:
      "성문지기를 한 번 잠재웠다면. 두 번째는 흠 없이 가져갈 수 있나? 빗장이 살갗에 닿기 전에. HP 70% 이상으로 옛 성문지기를 처치.",
    requiredLevel: 13,
    target: { kind: "kill_within_hp", monsterName: "옛 성문지기", minHpFraction: 0.7, count: 1 },
    reward: { gold: 600, fame: 16, exp: 1000 },
    repeatable: false,
    giverNpcId: "dustford_keeper",
    requiresQuestCompleted: "dustford-mujin-gatekeeper",
  },
  {
    id: "dustford-mujin-challenge-no-potion",
    regionId: "dustford",
    title: "맨몸의 한 수",
    description:
      "옛 수비대는 약 주머니 없이 서 있었어. 포션 한 병도 쓰지 않고 옛 성문지기를 잠재워 보게.",
    requiredLevel: 13,
    target: { kind: "no_potion_boss", monsterName: "옛 성문지기", count: 1 },
    reward: { gold: 600, fame: 16, exp: 1000 },
    repeatable: false,
    giverNpcId: "dustford_keeper",
    requiresQuestCompleted: "dustford-mujin-gatekeeper",
  },
  {
    id: "dustford-mujin-challenge-garrison-set",
    regionId: "dustford",
    title: "수비대 한 복",
    description:
      "수비대 도검·사슬갑옷·성문지기의 핵. 셋을 한 복으로 갖춰 한 번이라도 차고 와 주게. 옛 수비대 한 식구가 다시 선 모습을 보고 싶소.",
    requiredLevel: 13,
    target: {
      kind: "equip_set",
      itemIds: ["garrison_blade", "garrison_hauberk", "gatekeeper_core"],
    },
    reward: { gold: 700, fame: 18, exp: 1100 },
    repeatable: false,
    giverNpcId: "dustford_keeper",
    requiresQuestCompleted: "dustford-mujin-gatekeeper",
  },
  // ── 마른나루 옛길 — 새 quest kind 의뢰 ─────────────────────────────────
  // PR A 에서 도입한 craft_item / talk_to_npc / visit_region / kill_within_hp 를
  // 인트로 라인의 자연스러운 4 번째 단계로 매단다. 각 NPC 의 인트로 의뢰를 한 번
  // 마친 뒤에야 노출돼, 라인 어휘를 끊지 않는다.
  {
    // craft_item — 두루 라인 마지막 단계. 옛 군기 망토(군기 한 폭 + 또 한 폭) 1 회 제작.
    // tattered_standard_cloak 은 노상강도가 떨궈 모이고, 합쳐 frontier_standard_cloak.
    id: "dustford-duru-standard-restore",
    regionId: "dustford",
    title: "두루의 청: 옛 군기 복원",
    description:
      "성채까지 다닌다며? 그럼 부탁 하나 더. 옛 변경 군기, 한 폭을 잇대 복원한 걸 한 번이라도 두르고 와 줘. 마른나루 노인들이 그 깃 한 번 보고 싶어 해. 군기 망토(frontier_standard_cloak) 1점 제작.",
    requiredLevel: 9,
    target: { kind: "craft_item", itemId: "frontier_standard_cloak", count: 1 },
    reward: { gold: 360, fame: 14, exp: 520 },
    repeatable: false,
    giverNpcId: "dustford_scavenger",
    requiresQuestCompleted: "dustford-duru-scrap",
  },
  {
    // talk_to_npc — 나래 라인 마지막 단계. 보리(역참 아이)를 N 번 들어주기.
    id: "dustford-narae-listen-bori",
    regionId: "dustford",
    title: "나래의 청: 보리 들어주기",
    description:
      "그 애가 요즘 통 말이 적어요. 밤마다 옛길 끝 쪽을 본대요. 자기는 안 무섭다면서. 들어줄 사람이 있어야지요. 보리와 세 번만 이야기를 나눠 주세요.",
    requiredLevel: 4,
    target: { kind: "talk_to_npc", npcId: "dustford_kid", count: 3 },
    reward: { gold: 200, fame: 10, exp: 240, potions: [{ id: "potion_heal_s", count: 5 }] },
    repeatable: false,
    giverNpcId: "dustford_innkeeper",
    requiresQuestCompleted: "dustford-narae-feathers",
  },
  {
    // visit_region — 보리(역참 아이) 가 처음으로 내주는 의뢰. 성문이 열린 뒤,
    // 옛 성채에 다섯 번 들어갔다 와서 어떻게 생겼는지 이야기해 달라는 어린애의 부탁.
    id: "dustford-bori-keep-tour",
    regionId: "dustford",
    title: "보리의 청: 성채 한 바퀴",
    description:
      "무진 할아버지는 안 데려가 줘요. 아저씨가 다섯 번만 더 갔다 와서, 안이 어떻게 생겼는지 다 말해 줘요. 흉벽도, 우물도, 안마당도. 옛 성채 5회 방문.",
    requiredLevel: 9,
    target: { kind: "visit_region", regionId: "oldwall_keep", count: 5 },
    reward: { gold: 220, fame: 11, exp: 320 },
    repeatable: false,
    giverNpcId: "dustford_kid",
    requiresQuestCompleted: "dustford-mujin-clear-road",
    // 다이얼로그 게이트: gatekeeper_felled && KEEP_FLAG_UNSEALED — prereq 만으로 못 표현 → hidden.
    hidden: true,
  },
  {
    // kill_within_hp — 솔개 라인 마지막 단계. 노상강도 5 마리를 HP 70% 이상으로 처치.
    // 들사냥꾼다운 "흠 없는 한 수" 어휘를 잡몹으로 끌어다 일상 도전으로 둔다.
    id: "dustford-solgae-pristine-bandits",
    regionId: "dustford",
    title: "솔개의 청: 흠 없는 사냥",
    description:
      "들사냥꾼 한 수는 빗장 맞기 전에 끝내는 거야. 노상강도 다섯을. HP 70% 이상으로. 흠 없이 잡아 와 봐. 그게 가능하면 옛길에서 자네 이름이 좀 알려질 거다.",
    requiredLevel: 5,
    target: {
      kind: "kill_within_hp",
      monsterName: "노상강도",
      minHpFraction: 0.7,
      count: 5,
    },
    reward: { gold: 280, fame: 12, exp: 380 },
    repeatable: false,
    giverNpcId: "dustford_hunter",
    requiresQuestCompleted: "dustford-solgae-ravens",
  },
  // ── 마른나루 길드 게시판 — 반복 의뢰 ─────────────────────────────────
  // 옛길 적 3종은 누구나, 옛 변경 성채 적 2종은 무진의 옛길 정리 완료 후 노출.
  {
    id: "dustford-board-wildcats",
    regionId: "dustford",
    title: "갈대밭의 들고양이",
    description:
      "옛길 갈대밭에 들고양이가 떼를 키워 시작 마을 쪽 밭까지 헤집습니다. 갈대 살쾡이 40마리를 정리해 주세요.",
    requiredLevel: 3,
    target: { kind: "kill", monsterName: "갈대 살쾡이", count: 40 },
    reward: { gold: 110, fame: 7, exp: 160 },
    repeatable: true,
  },
  {
    id: "dustford-board-ravens",
    regionId: "dustford",
    title: "옛길의 까마귀",
    description:
      "들까마귀 떼가 옛길을 뒤덮어 행상 짐을 노립니다. 들까마귀 떼 45마리를 정리해 주세요.",
    requiredLevel: 3,
    target: { kind: "kill", monsterName: "들까마귀 떼", count: 45 },
    reward: { gold: 105, fame: 7, exp: 150 },
    repeatable: true,
  },
  {
    id: "dustford-board-bandits",
    regionId: "dustford",
    title: "옛길의 노상강도",
    description:
      "옛길에 눌러앉은 노상강도가 시작 마을과 마른나루 사이 행상을 턴다는 신고가 들어왔습니다. 노상강도 36명을 정리해 주세요.",
    requiredLevel: 3,
    target: { kind: "kill", monsterName: "노상강도", count: 36 },
    reward: { gold: 130, fame: 8, exp: 170 },
    repeatable: true,
  },
  {
    id: "dustford-board-wall-ravens",
    regionId: "dustford",
    title: "흉벽을 도는 것들",
    description:
      "옛 변경 성채 흉벽에 폐성벽 까마귀가 둥지를 틀어 일꾼들이 못 올라갑니다. 폐성벽 까마귀 40마리를 정리해 주세요.",
    requiredLevel: 13,
    target: { kind: "kill", monsterName: "폐성벽 까마귀", count: 40 },
    reward: { gold: 340, fame: 16, exp: 580 },
    repeatable: true,
    requiresQuestCompleted: "dustford-mujin-clear-road",
  },
  {
    id: "dustford-board-automata",
    regionId: "dustford",
    title: "녹슨 보초들",
    description:
      "옛 변경 성채 안마당에 녹슨 자동인형이 아직도 보초를 돕니다. 30체를 부숴 주세요.",
    requiredLevel: 13,
    target: { kind: "kill", monsterName: "녹슨 자동인형", count: 30 },
    reward: { gold: 400, fame: 18, exp: 620 },
    repeatable: true,
    requiresQuestCompleted: "dustford-mujin-clear-road",
  },
  // ── 소만 (해안 지선) ─────────────────────────────────────────────────────
  // 갯벌(Lv10) 잡몹 의뢰 → 소만 신임(여울 보증) → 뱃사공 해랑 선저 덧대기(ferryman_reef_passage)
  // → 산호초 섬(Lv16~) 정찰 → 수심의 것 처치. 갈매/보말은 QuestLineDialogue, 해랑/여울은 커스텀.
  // 산호초 섬 적을 대상으로 하는 의뢰는 모두 해랑의 선저 덧대기(hull-plating) 완료를 선행으로 둔다.
  {
    id: "saltmarsh-galmae-crabs",
    regionId: "saltmarsh",
    title: "갈매의 통발: 집게발 게",
    description:
      "갯벌에 집게발 게가 너무 불어 통발이며 그물이 남아나질 않아요. 집게발 게 20마리를 솎아 주세요. (게딱지 손방패와 갯벌 각반 짜는 법을 알려줍니다)",
    requiredLevel: 10,
    target: { kind: "kill", monsterName: "집게발 게", count: 20 },
    reward: { gold: 200, fame: 12, exp: 380, recipes: ["crab_shell_buckler", "tideflats_waders"] },
    repeatable: false,
    giverNpcId: "saltmarsh_salter",
  },
  {
    id: "saltmarsh-galmae-reef-coral",
    regionId: "saltmarsh",
    title: "갈매의 청: 산호 가시",
    description:
      "산호 가시는 송곳이며 통발 미늘로 두루 쓰여요. 암초에서 부러진 산호 가시 8개만 들여와 주면 사례하지요.",
    requiredLevel: 16,
    target: { kind: "deliver", materialId: "coral_spine", count: 8 },
    reward: { gold: 360, fame: 17, exp: 700 },
    repeatable: false,
    giverNpcId: "saltmarsh_salter",
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
  },
  {
    id: "saltmarsh-bomal-crab-shells",
    regionId: "saltmarsh",
    title: "보말의 게장: 게딱지",
    description:
      "손님상에 올릴 게장을 담그려는데 게딱지가 모자라네요. 게딱지 10개만 들여와 주면 섭섭잖게 사례할게요.",
    requiredLevel: 10,
    target: { kind: "deliver", materialId: "crab_shell", count: 10 },
    reward: { gold: 150, fame: 10, exp: 320, potions: [{ id: "potion_heal_s", count: 5 }] },
    repeatable: false,
    giverNpcId: "saltmarsh_innkeeper",
  },
  {
    id: "saltmarsh-bomal-galley-larder",
    regionId: "saltmarsh",
    title: "보말의 곳간 채우기",
    description:
      "대상 길손이 줄줄이 들이닥칠 철이라 곳간을 단단히 채워야 해요. 게딱지 15개만 더 들여와 주면. 손님이 두고 간 약 주머니를 손봐서 드릴게요.",
    requiredLevel: 11,
    target: { kind: "deliver", materialId: "crab_shell", count: 15 },
    reward: { gold: 240, fame: 13, exp: 420, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "saltmarsh_innkeeper",
  },
  {
    id: "saltmarsh-bomal-reef-stew",
    regionId: "saltmarsh",
    title: "보말의 솥: 갑각 약탈자",
    description:
      "난바다에서 갑각 약탈자들이 어선까지 따라붙는대요. 15만 정리해 주면 어선이 다시 나갈 거예요.",
    requiredLevel: 16,
    target: { kind: "kill", monsterName: "갑각 약탈자", count: 15 },
    reward: { gold: 380, fame: 18, exp: 760 },
    repeatable: false,
    giverNpcId: "saltmarsh_innkeeper",
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
  },
  {
    id: "saltmarsh-haerang-hull-plating",
    regionId: "saltmarsh",
    title: "선저 덧대기",
    description:
      "암초 사이를 지나려면 배 밑을 게딱지 갑판으로 덧대야 해. 게딱지 15개만 모아다 줘. 그러면 난바다로 데려가 주지.",
    requiredLevel: 13,
    target: { kind: "deliver", materialId: "crab_shell", count: 15 },
    reward: { gold: 320, fame: 16, exp: 600 },
    repeatable: false,
    giverNpcId: "saltmarsh_ferryman",
    // 다이얼로그 게이트: storyFlags.has("saltmarsh_vouched") → hidden.
    hidden: true,
  },
  {
    id: "saltmarsh-haerang-reef-runs",
    regionId: "saltmarsh",
    title: "건넨 김에: 사이렌 쫓기",
    description:
      "난바다를 건널 때마다 사이렌 노랫소리가 뱃머리를 돌려세워. 산호초 사이렌 20만 쫓아 주면 뱃길이 한결 수월하겠어.",
    requiredLevel: 16,
    target: { kind: "kill", monsterName: "산호초 사이렌", count: 20 },
    reward: { gold: 400, fame: 18, exp: 800 },
    repeatable: false,
    giverNpcId: "saltmarsh_ferryman",
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
  },
  {
    id: "saltmarsh-yeoul-reef-survey",
    regionId: "saltmarsh",
    title: "여울의 청: 암초 살피기",
    description:
      "해랑이 자네를 난바다로 데려갔다고 들었네. 그렇다면 부탁이 있어. 암초 둘레의 산호가 어떻게 자라는지 봐 주게. 심해 비늘 10조각이면 충분해. 그걸 보면 밑에서 자는 것이 얼마나 깨어났는지 알 수 있네.",
    requiredLevel: 16,
    target: { kind: "deliver", materialId: "deep_scale", count: 10 },
    reward: { gold: 460, fame: 20, exp: 900 },
    repeatable: false,
    giverNpcId: "saltmarsh_elder",
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
  },
  {
    id: "saltmarsh-yeoul-deep-one",
    regionId: "saltmarsh",
    title: "수심의 것",
    description:
      "이제 알겠네. 암초 밑에서 뒤척이는 그것이 잠잠해지지 않는 한, 이 포구는 다시 일어서지 못해. 수심의 것. 단단히 준비해 가서 그것을 가라앉혀 주게. 소만의 명운이 거기 달렸네.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "수심의 것", count: 1 },
    reward: {
      gold: 900,
      fame: 26,
      exp: 1300,
      potions: [{ id: "potion_heal_m", count: 5 }],
      recipes: ["abyssal_heart"],
    },
    repeatable: false,
    giverNpcId: "saltmarsh_elder",
    requiresQuestCompleted: "saltmarsh-yeoul-reef-survey",
  },
  {
    id: "saltmarsh-deep-one-recurring",
    regionId: "saltmarsh",
    title: "수심의 것: 다시 뒤척일 때",
    description:
      "한 번 가라앉혔다고 끝이 아니야. 또 물이 차거든. 수심의 것을 세 번 더 가라앉혀 주게. 소만이 자네를 기억할 게요.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "수심의 것", count: 3 },
    reward: { gold: 1100, fame: 28, exp: 1500 },
    repeatable: false,
    giverNpcId: "saltmarsh_elder",
    requiresQuestCompleted: "saltmarsh-yeoul-deep-one",
  },
  // ── 소만 — 새 quest kind 의뢰 ─────────────────────────────────────────
  // craft_item / talk_to_npc / visit_region / equip_item / equip_set / kill_within_hp
  // / no_potion_boss 를 자연스러운 4 번째 단계로 매단다. 보스 후 도전 3 종은 무진 패턴
  // 그대로 — kill_within_hp / no_potion_boss / equip_set 을 한 라인에서 검증.
  {
    // craft_item — 갈매 라인 마지막 단계. 게딱지 손방패 2 점 제작.
    // 게딱지 손방패 제작서는 갈매의 첫 의뢰(crabs) 보상으로 받는다.
    id: "saltmarsh-galmae-shell-forge",
    regionId: "saltmarsh",
    title: "갈매의 청: 게딱지 손방패 두 점",
    description:
      "이번엔 통발 손질이 아니라 자네 손을 빌려야겠어. 게딱지 손방패, 두 점만 새로 짜서 가져와 줘. 갯벌 다니는 일꾼 둘에게 한 점씩 들려 보내려고. 솜씨 좋게.",
    requiredLevel: 11,
    target: { kind: "craft_item", itemId: "crab_shell_buckler", count: 2 },
    reward: { gold: 320, fame: 13, exp: 480 },
    repeatable: false,
    giverNpcId: "saltmarsh_salter",
    requiresQuestCompleted: "saltmarsh-galmae-crabs",
  },
  {
    // talk_to_npc — 보말 라인 마지막 단계. 미르(갯마을 아이)를 N 번 들어주기.
    id: "saltmarsh-bomal-listen-mireu",
    regionId: "saltmarsh",
    title: "보말의 청: 미르 들어주기",
    description:
      "그 애가 요즘 통 말이 적어요. 한낮에도 갯벌만 보고 있고요. 들어줄 사람이 있어야지요. 미르와 세 번만 이야기를 나눠 주세요. 사례는 손님이 두고 간 회복약으로요.",
    requiredLevel: 11,
    target: { kind: "talk_to_npc", npcId: "saltmarsh_kid", count: 3 },
    reward: { gold: 220, fame: 11, exp: 280, potions: [{ id: "potion_heal_s", count: 5 }] },
    repeatable: false,
    giverNpcId: "saltmarsh_innkeeper",
    requiresQuestCompleted: "saltmarsh-bomal-crab-shells",
  },
  {
    // visit_region — 미르(갯마을 아이) 가 처음으로 내주는 의뢰. 해랑이 배를 내준 뒤,
    // 산호초 섬에 다섯 번 다녀와 어떻게 생겼는지 이야기해 달라는 어린애의 부탁.
    id: "saltmarsh-mireu-reef-tour",
    regionId: "saltmarsh",
    title: "미르의 청: 산호초 섬 한 바퀴",
    description:
      "해랑 아저씨는 안 데려가 줘요. 아저씨가 다섯 번만 더 갔다 와서, 산호초 섬이 어떻게 생겼는지 다 말해 줘요. 안개도, 사이렌 노래도, 가시 산호도. 산호초 섬 5회 방문.",
    requiredLevel: 16,
    target: { kind: "visit_region", regionId: "reef_isle", count: 5 },
    reward: { gold: 280, fame: 13, exp: 460 },
    repeatable: false,
    giverNpcId: "saltmarsh_kid",
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
    // 다이얼로그 게이트: stilled(deep_one_stilled) && crossed — prereq 만으론 표현 불가 → hidden.
    hidden: true,
  },
  {
    // equip_item — 해랑 라인 마지막 단계. 산호 가시 단검을 한 번이라도 차고 와라.
    // 뱃사공이 "산호 가시쯤은 익숙해야 난바다를 건너지" 라고 말하는 결.
    id: "saltmarsh-haerang-coral-bear",
    regionId: "saltmarsh",
    title: "해랑의 청: 산호 가시 자루",
    description:
      "암초를 자주 건너는 사람은 산호 가시쯤은 손에 익숙해야 해. 산호 가시 단검. 한 번이라도 차고 와 줘. 그래야 뱃삯도 깎아 주지.",
    requiredLevel: 16,
    target: { kind: "equip_item", itemId: "coral_spine_dagger" },
    reward: { gold: 260, fame: 12, exp: 420 },
    repeatable: false,
    giverNpcId: "saltmarsh_ferryman",
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
  },
  // ── 소만 — 수심의 것 보스 재도전 3 종 ──────────────────────────────────
  // kill_within_hp / no_potion_boss / equip_set 의 인게임 검증. 무진 라인과 짝.
  // 보스 처치(saltmarsh-yeoul-deep-one) 완료 후에만 노출되며, YeoulDialogue 가 한
  // 번에 한 단계씩 차례로 제안한다.
  {
    id: "saltmarsh-yeoul-challenge-pristine",
    regionId: "saltmarsh",
    title: "흠 없는 한 잠수",
    description:
      "수심의 것을 한 번 가라앉혔다면. 두 번째는 흠 없이 가져갈 수 있나? 소용돌이가 등을 핥기 전에. HP 70% 이상으로 수심의 것을 처치.",
    requiredLevel: 18,
    target: {
      kind: "kill_within_hp",
      monsterName: "수심의 것",
      minHpFraction: 0.7,
      count: 1,
    },
    reward: { gold: 700, fame: 18, exp: 1100 },
    repeatable: false,
    giverNpcId: "saltmarsh_elder",
    requiresQuestCompleted: "saltmarsh-yeoul-deep-one",
  },
  {
    id: "saltmarsh-yeoul-challenge-no-potion",
    regionId: "saltmarsh",
    title: "마른 한 잠수",
    description:
      "옛 잠수부는 약 주머니 없이 물에 들었어. 포션 한 병도 쓰지 않고 수심의 것을 가라앉혀 보게.",
    requiredLevel: 18,
    target: { kind: "no_potion_boss", monsterName: "수심의 것", count: 1 },
    reward: { gold: 700, fame: 18, exp: 1100 },
    repeatable: false,
    giverNpcId: "saltmarsh_elder",
    requiresQuestCompleted: "saltmarsh-yeoul-deep-one",
  },
  {
    // equip_set — 무기 / 갑옷 / 액세서리 슬롯이 겹치지 않게 골랐다. 셋을 동시에 차야 진행.
    id: "saltmarsh-yeoul-challenge-abyssal-set",
    regionId: "saltmarsh",
    title: "심연의 한 복",
    description:
      "심연 칼날·사이렌 노래 망토·수심의 핵. 셋을 한 복으로 갖춰 한 번이라도 차고 와 주게. 옛 잠수부 한 식구가 다시 선 모습을 보고 싶소.",
    requiredLevel: 18,
    target: {
      kind: "equip_set",
      itemIds: ["abyssal_edge", "siren_song_mantle", "abyssal_heart"],
    },
    reward: { gold: 800, fame: 20, exp: 1200 },
    repeatable: false,
    giverNpcId: "saltmarsh_elder",
    requiresQuestCompleted: "saltmarsh-yeoul-deep-one",
  },
  // ── 소만 길드 게시판 — 반복 의뢰 ──────────────────────────────────────
  // 갯벌 적 3종은 누구나, 산호초 섬 적 2종은 해랑의 선저 덧대기 완료 후 노출.
  {
    id: "saltmarsh-board-crabs",
    regionId: "saltmarsh",
    title: "갯벌의 집게발",
    description:
      "썰물 때마다 집게발 게가 갯벌 길을 막아 디올라 어부들이 건너오질 못합니다. 집게발 게 45마리를 정리해 주세요.",
    requiredLevel: 10,
    target: { kind: "kill", monsterName: "집게발 게", count: 45 },
    reward: { gold: 220, fame: 12, exp: 400 },
    repeatable: true,
  },
  {
    id: "saltmarsh-board-shore-birds",
    regionId: "saltmarsh",
    title: "갯도요 떼",
    description:
      "갯도요 떼가 소만 어판장 생선을 노립니다. 40마리를 쫓아내 주세요.",
    requiredLevel: 10,
    target: { kind: "kill", monsterName: "갯도요", count: 40 },
    reward: { gold: 230, fame: 12, exp: 400 },
    repeatable: true,
  },
  {
    id: "saltmarsh-board-mudfish",
    regionId: "saltmarsh",
    title: "진창의 미꾸라지",
    description:
      "진흙 미꾸라지가 소금밭 수로를 헤집어 놓습니다. 40마리를 정리해 주세요.",
    requiredLevel: 10,
    target: { kind: "kill", monsterName: "진흙 미꾸라지", count: 40 },
    reward: { gold: 210, fame: 11, exp: 380 },
    repeatable: true,
  },
  {
    id: "saltmarsh-board-sirens",
    regionId: "saltmarsh",
    title: "안개 너머의 노랫소리",
    description:
      "산호초 섬 둘레로 사이렌 노랫소리가 짙어져 어선이 나가질 못합니다. 산호초 사이렌 45를 잠재워 주세요.",
    requiredLevel: 16,
    target: { kind: "kill", monsterName: "산호초 사이렌", count: 45 },
    reward: { gold: 380, fame: 18, exp: 760 },
    repeatable: true,
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
  },
  {
    id: "saltmarsh-board-coral-golems",
    regionId: "saltmarsh",
    title: "암초를 걷는 것들",
    description:
      "가시 산호 골렘이 암초 사이 뱃길을 막아섭니다. 30체를 부숴 주세요.",
    requiredLevel: 16,
    target: { kind: "kill", monsterName: "가시 산호 골렘", count: 30 },
    reward: { gold: 420, fame: 19, exp: 780 },
    repeatable: true,
    requiresQuestCompleted: "saltmarsh-haerang-hull-plating",
  },
  // ── 운향 — 메인 라인 "잠들지 않는 산" (노촌장 백운) ──────────────────────
  // 운향 도달(= 운봉의 거인과 한 번 맞붙음, peak_giant_engaged) → 협곡 정찰 →
  // 운봉의 거인 처치 → 교역로 정리 2종 → 정기 토벌. 백운 대사 분기는 BaekunDialogue.
  {
    id: "unhyang-baekun-canyon-survey",
    regionId: "unhyang",
    title: "산이 깨어나는 소리",
    description:
      "협곡의 무리장 늑대들이 요즘 평소와 다르게 움직인다네. 그놈들이 어떻게 무리를 끌고 다니는지 보면, 산이 어디까지 깨어났는지 알 수 있을 게야. 세 마리만 정리하고 와 주겠나?",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "늑대 무리장", count: 3 },
    reward: { gold: 700, fame: 24, exp: 1000, materials: [{ id: "giant_scale", count: 3 }] },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    // 다이얼로그 게이트: storyFlags.has("peak_giant_engaged") (운향 진입 시 거의 켜져 있음).
    // 안전하게 hidden — 운향 도달 전 신규 캐릭터에게 뱃지 노출 방지.
    hidden: true,
  },
  {
    id: "unhyang-baekun-peak-giant",
    regionId: "unhyang",
    title: "운봉의 거인",
    description:
      "이제 알겠네. 산 깊은 곳에 잠들지 않는 것이 버티는 한, 이 산정은 평온할 수 없어. 운봉의 거인. 혼자선 어림없는 상대지. 동료를 모아 그놈을 잠재워 주게. 산정의 명운이 거기 달렸다네.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "운봉의 거인", count: 1 },
    reward: { gold: 1800, fame: 60, exp: 4500, items: [{ id: "peak_heart", count: 1 }] },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    requiresQuestCompleted: "unhyang-baekun-canyon-survey",
  },
  {
    id: "unhyang-baekun-cliff-wolves",
    regionId: "unhyang",
    title: "교역로 정리 ─ 협곡",
    description:
      "거인이 잠든 지금이 기회야. 협곡 길에 절벽 늑대가 너무 많아 짐꾼들이 다니질 못해. 서른 마리만 솎아 주게. 디올라와 다시 거래를 트려면 길부터 안전해야 하니.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 30 },
    reward: { gold: 500, fame: 22, exp: 900, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  {
    id: "unhyang-baekun-highland-goats",
    regionId: "unhyang",
    title: "교역로 정리 ─ 산기슭",
    description:
      "산기슭 비탈은 산양 떼가 바위를 굴려대서 위험하다네. 마흔 마리만 정리해 주게. 그래야 아랫마을 짐수레가 비탈을 오를 수 있어.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "산양", count: 40 },
    reward: { gold: 450, fame: 20, exp: 800 },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  {
    id: "unhyang-peak-giant-recurring",
    regionId: "unhyang",
    title: "운봉의 거인 토벌 ─ 정기",
    description:
      "거인은 잠재워도 산의 숨결을 먹고 다시 일어선다네. 세 번이면 한동안은 산정이 조용할 게야. 동료들과 함께 가 주게.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "운봉의 거인", count: 3 },
    reward: { gold: 900, fame: 22, exp: 1800 },
    repeatable: true,
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  // 만월 — "운봉석을 벼리는 법"(견갑 확정) → 후속 "운봉 네 자루"(무기 4종 제작서 확정).
  // 운봉 무기 4종은 운봉의 거인 보스 드롭(recipe_one_of)으로도 풀리지만, 이 의뢰가 확정 루트.
  {
    id: "unhyang-manwol-ore-demo",
    regionId: "unhyang",
    title: "운봉석을 벼리는 법",
    description:
      "운봉석은 제대로 다룰 줄 아는 손이 드물어. 자네가 운봉석 여섯 덩이만 가져오면, 그걸로 시연을 보여줌세. 거인 어깨 비늘로 견갑을 어떻게 짜는지. 보고 나면 자네 손에도 새겨질 거야.",
    requiredLevel: 22,
    target: { kind: "deliver", materialId: "unbong_ore", count: 6 },
    reward: { gold: 500, exp: 800, recipes: ["peak_mantle"], potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "unhyang_smith",
    // 다이얼로그 게이트: storyFlags.has("peak_giant_defeated") → hidden.
    hidden: true,
  },
  {
    id: "unhyang-manwol-weapons",
    regionId: "unhyang",
    title: "운봉 네 자루",
    description:
      "견갑은 봤으니 이제 무기 차례야. 운봉석 여덟 덩이면. 대검, 방벽, 장창, 발톱. 네 자루 전부 벼리는 법을 새겨 줌세. 손에 맞는 걸 골라 쓰게.",
    requiredLevel: 22,
    target: { kind: "deliver", materialId: "unbong_ore", count: 8 },
    reward: { gold: 800, exp: 1200, recipes: ["peak_sword", "peak_shield", "peak_spear", "peak_claw"] },
    repeatable: false,
    giverNpcId: "unhyang_smith",
    requiresQuestCompleted: "unhyang-manwol-ore-demo",
  },
  // ── 운향 — 사이드 의뢰 (도연 / 산하) ────────────────────────────────────
  {
    id: "unhyang-sanha-herbs",
    regionId: "unhyang",
    title: "산초꽃 채집",
    description:
      "산기슭에 피는 산초꽃이 필요해요. 8송이만 모아다 주시면, 약 만드는 솜씨로 보답할게요. 산초꽃을 누벼 만드는 조끼, 그 만드는 법도 적어 드릴게요.",
    requiredLevel: 18,
    target: { kind: "deliver", materialId: "sancho_blossom", count: 8 },
    reward: { gold: 300, exp: 450, potionCapacityBonus: 1, recipes: ["sancho_vest"] },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  {
    id: "unhyang-sanha-bones",
    regionId: "unhyang",
    title: "거인 비늘 다섯",
    description:
      "거인의 비늘은 약을 갈무리하기에 그만이에요. 5개만 모아다 주시면 회복약을 가득 챙겨드릴게요.",
    requiredLevel: 20,
    target: { kind: "deliver", materialId: "giant_scale", count: 5 },
    reward: {
      gold: 600,
      exp: 750,
      potions: [{ id: "potion_heal_s", count: 3 }],
    },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  // ── 운향 — 사이드 의뢰 추가 (도연 / 산하 / 백운) ────────────────────────
  {
    id: "unhyang-doyeon-stone-frogs",
    regionId: "unhyang",
    title: "산기슭의 바위 두꺼비",
    description:
      "산기슭 바위 두꺼비, 그놈들 등껍데기가 길을 막아. 열다섯 마리만 치워 주면 짐꾼들 발이 좀 편해질 거야.. 가는 김에 협곡 무리장 늑대도 한 마리 봐 두면 굵은 송곳니가 나올 거야. 그게 나오면 단검 만드는 법도 함께 알려줄게.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "바위 두꺼비", count: 15 },
    reward: { gold: 360, fame: 18, exp: 600, recipes: ["wolfking_fang_dagger"] },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  {
    id: "unhyang-guide-bison-down",
    regionId: "unhyang",
    title: "산정 아래 들소 떼",
    description:
      "산정 아래 들판 가봤어? 들소 떼가 길을 떡 막아. 스무 마리만 솎아 주면 짐수레가 좀 다닐 거야.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "들소", count: 20 },
    reward: { gold: 450, fame: 20, exp: 700 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  {
    id: "unhyang-sanha-tough-hide",
    regionId: "unhyang",
    title: "단단한 가죽 여섯",
    description:
      "단단한 가죽으로 약 보따리를 싸야 하거든요. 여섯 장만 모아다 주시면 회복약으로 보답할게요.",
    requiredLevel: 18,
    target: { kind: "deliver", materialId: "tough_hide", count: 6 },
    reward: { gold: 420, exp: 600, potions: [{ id: "potion_heal_s", count: 3 }] },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  {
    id: "unhyang-sanha-windstone",
    regionId: "unhyang",
    title: "바람 마석 넷",
    description:
      "바람 마석은 약을 오래 갈무리하는 데 그만이에요. 넷만 구해다 주시면 약 주머니를 더 크게 만들어 드릴게요.",
    requiredLevel: 20,
    target: { kind: "deliver", materialId: "wind_mana_stone", count: 4 },
    reward: { gold: 500, exp: 700, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  {
    id: "unhyang-sanha-bison-hide",
    regionId: "unhyang",
    title: "들소 가죽 여섯",
    description:
      "들소 가죽으로 약상자를 짜야겠어요. 여섯 장만 모아다 주시면 회복약으로 보답할게요.",
    requiredLevel: 28,
    target: { kind: "deliver", materialId: "bison_hide", count: 6 },
    reward: { gold: 550, exp: 800, potions: [{ id: "potion_heal_s", count: 3 }] },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  {
    id: "unhyang-baekun-pilgrim-escort",
    regionId: "unhyang",
    title: "순례자의 길",
    description:
      "북쪽에서 온 순례자가 운저 평원을 지나 다시 떠난다네. 거기 떠돌이 약탈자 무리가 자리를 잡았다더군. 열다섯만 손봐 주겠나? 순례자가 무사히 지나가게.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "떠돌이 약탈자", count: 15 },
    reward: { gold: 450, fame: 20, exp: 800 },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  // 산하 ↔ 노라(디올라 여관) — 산정 약초 배송(§7.2). 완료 시 sanha_nora_herbs_sent flag
  // + herbalists_courier 칭호 (page.tsx). 디올라 노라 다이얼로그가 갱신된다.
  {
    id: "unhyang-sanha-nora-herbs",
    regionId: "unhyang",
    title: "디올라로 보내는 약초",
    description:
      "디올라 여관 주인 노라한테 산정 약초를 좀 보내고 싶어요. 산초꽃 열 송이만 모아다 주시면 제가 부쳐 드릴게요. 답례는 노라가 직접 챙겨 줄 거예요. 디올라 들르면 인사 한번 하시고요.",
    requiredLevel: 18,
    target: { kind: "deliver", materialId: "sancho_blossom", count: 10 },
    reward: { gold: 400, exp: 600, potions: [{ id: "potion_heal_s", count: 5 }], potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  // 나무꾼 지미 ↔ 산악 가이드 도연(§7.1). 지미가 운을 떼고, 도연이 실제 의뢰를 준다.
  // 완료 시 jimmy_doyeon_timber_done flag → 시작 마을 지미 다이얼로그 갱신.
  {
    id: "village-jimmy-doyeon-timber",
    regionId: "unhyang",
    title: "산정의 단단한 목재",
    description:
      "시작 마을 나무꾼 지미가 산정 협곡의 목재 이야기를 하더라고. 그건 절벽 늑대 소굴 안쪽에 있어. 열다섯 마리만 정리하면 안전하게 베어 와서 지미한테 부쳐 줄게.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 15 },
    reward: { gold: 400, fame: 16, exp: 600, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  // ── 운향 모험가 길드 게시판 (정식 로스터) ──────────────────────────────
  {
    id: "unhyang-board-goats",
    regionId: "unhyang",
    title: "산기슭: 산양 정리",
    description: "산기슭 비탈에 산양 떼가 다시 늘었습니다. 45마리를 정리해 주세요.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "산양", count: 45 },
    reward: { gold: 320, fame: 14, exp: 650 },
    repeatable: true,
  },
  {
    id: "unhyang-board-goats-large",
    regionId: "unhyang",
    title: "산기슭: 산양 대규모 정리",
    description: "산양 떼가 비탈 전체를 뒤덮었습니다. 80마리를 정리해 주세요.",
    requiredLevel: 19,
    target: { kind: "kill", monsterName: "산양", count: 80 },
    reward: { gold: 620, fame: 24, exp: 1250 },
    repeatable: true,
  },
  {
    id: "unhyang-board-stone-frogs",
    regionId: "unhyang",
    title: "산기슭: 바위 두꺼비 구제",
    description: "산기슭 길목을 바위 두꺼비가 메우고 있습니다. 40마리를 구제해 주세요.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "바위 두꺼비", count: 40 },
    reward: { gold: 360, fame: 16, exp: 700 },
    repeatable: true,
  },
  {
    id: "unhyang-board-cliff-wolves",
    regionId: "unhyang",
    title: "협곡: 절벽 늑대 사냥",
    description: "협곡 길에 절벽 늑대가 떼를 이뤘습니다. 40마리를 사냥해 주세요.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 40 },
    reward: { gold: 360, fame: 16, exp: 700 },
    repeatable: true,
  },
  {
    id: "unhyang-board-cliff-wolves-large",
    regionId: "unhyang",
    title: "협곡: 절벽 늑대 대규모 사냥",
    description: "절벽 늑대가 협곡 전체를 장악했습니다. 75마리를 사냥해 주세요.",
    requiredLevel: 21,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 75 },
    reward: { gold: 700, fame: 26, exp: 1300 },
    repeatable: true,
  },
  {
    id: "unhyang-board-windspirits",
    regionId: "unhyang",
    title: "협곡: 돌풍 정령 진정",
    description: "협곡에 돌풍 정령이 몰려 길이 위태롭습니다. 35체를 진정시켜 주세요.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "돌풍 정령", count: 35 },
    reward: { gold: 380, fame: 17, exp: 720 },
    repeatable: true,
  },
  {
    id: "unhyang-board-wolf-chieftain",
    regionId: "unhyang",
    title: "협곡: 무리장 솎아내기",
    description:
      "협곡 무리장 늑대들의 패턴이 파악됐습니다. 6마리를 솎아내면 길목이 한결 안전해질 거요.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "늑대 무리장", count: 6 },
    reward: { gold: 500, fame: 20, exp: 1100 },
    repeatable: true,
    requiresQuestCompleted: "unhyang-baekun-canyon-survey",
  },
  {
    id: "unhyang-board-grand-hunt",
    regionId: "unhyang",
    title: "운봉: 대규모 무리장 토벌",
    description:
      "산정이 잠잠해진 지금이 기회입니다. 무리장 늑대 12마리를 토벌해 산정의 노래에 이름을 남기세요.",
    requiredLevel: 24,
    target: { kind: "kill", monsterName: "늑대 무리장", count: 12 },
    reward: { gold: 1100, fame: 36, exp: 2400 },
    repeatable: true,
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  {
    id: "unhyang-board-supply-escort",
    regionId: "unhyang",
    title: "디올라행 짐수레 호위",
    description:
      "디올라와의 교역로가 열렸습니다. 폐허 어귀 늑대 40마리를 정리해 디올라행 짐수레 길을 지켜 주세요.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "폐허 늑대", count: 40 },
    reward: { gold: 500, fame: 18, exp: 950 },
    repeatable: true,
    requiresQuestCompleted: "diola-marin-mountain-trade",
  },
  // ── 다리 구간 — 운저 평원 (운향에서 받는 첫 의뢰) ───────────────────────
  {
    id: "unhyang-guide-cloud-raiders",
    regionId: "unhyang",
    title: "평원의 약탈자",
    description:
      "운향 아래로 내려가면 너른 들판이 펼쳐져 있어. 요즘 거기 떠돌이 약탈자 무리가 자리를 잡았다더군. 15명만 손봐 주겠나?",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "떠돌이 약탈자", count: 15 },
    reward: { gold: 450, fame: 20, exp: 700 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  // 운향 길드 게시판 — 운저 평원 정기 의뢰 (바람골 게시판에서 이관, 운향 바로 아래 들녘).
  // id 의 windvale- 접두는 플레이어 진행도 보존을 위해 그대로 유지.
  {
    id: "windvale-bison-cull",
    regionId: "unhyang",
    title: "운저 평원: 들소 정리",
    description:
      "운저 평원 들소가 다시 떼를 이뤘습니다. 40마리를 정리해 주세요.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "들소", count: 40 },
    reward: { gold: 400, fame: 16, exp: 700 },
    repeatable: true,
  },
  {
    id: "windvale-board-bison-large",
    regionId: "unhyang",
    title: "운저 평원: 들소 대규모 정리",
    description: "들소가 평원 전체를 뒤덮었습니다. 75마리를 정리해 주세요.",
    requiredLevel: 29,
    target: { kind: "kill", monsterName: "들소", count: 75 },
    reward: { gold: 760, fame: 26, exp: 1350 },
    repeatable: true,
  },
  {
    id: "windvale-board-hawks",
    regionId: "unhyang",
    title: "운저 평원: 초원 매 사냥",
    description: "초원 매가 평원 짐수레를 노립니다. 35마리를 사냥해 주세요.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "초원 매", count: 35 },
    reward: { gold: 380, fame: 14, exp: 650 },
    repeatable: true,
  },
  {
    id: "windvale-board-raiders",
    regionId: "unhyang",
    title: "운저 평원: 약탈자 소탕",
    description: "떠돌이 약탈자가 평원 길목에 자리 잡았습니다. 30명을 소탕해 주세요.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "떠돌이 약탈자", count: 30 },
    reward: { gold: 420, fame: 16, exp: 700 },
    repeatable: true,
  },
  // ── 다리 구간 — 바람골 역참 ─────────────────────────────────────────────
  {
    id: "windvale-keeper-bison",
    regionId: "windvale",
    title: "들소 떼 솎아내기",
    description:
      "들소 떼가 역참 울타리를 자꾸 들이받아서 못 살겠소. 20마리만 솎아 주시면 사례하리다.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "들소", count: 20 },
    reward: { gold: 550, fame: 22, exp: 850 },
    repeatable: false,
    giverNpcId: "windvale_keeper",
  },
  {
    id: "windvale-merchant-hawk-feathers",
    regionId: "windvale",
    title: "초원 매 깃털 다섯 장",
    description:
      "초원 매 깃털이 세공에 그만이거든. 5장만 모아다 주면 길에서 주운 좋은 걸 나눠 드리지. 깃털로 가벼운 망토를 짜는 법도 함께 알려 줌세.",
    requiredLevel: 28,
    target: { kind: "deliver", materialId: "hawk_feather", count: 5 },
    reward: { gold: 500, exp: 600, potionCapacityBonus: 1, recipes: ["hawkfeather_cloak"] },
    repeatable: false,
    giverNpcId: "windvale_merchant",
  },
  {
    id: "windvale-pathfinder-golems",
    regionId: "windvale",
    title: "잿빛 협로의 길막이",
    description:
      "봉황령으로 길을 내려는데 재먼지 골렘이 길목을 막고 있어요. 15체만 부숴 주시면 그 너머로 가는 길을 알려드릴게요.",
    requiredLevel: 34,
    target: { kind: "kill", monsterName: "재먼지 골렘", count: 15 },
    reward: { gold: 650, fame: 24, exp: 950 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
  },
  // 바람골 역참 길드 게시판 — 잿빛 협로(다리 동쪽) 반복 의뢰.
  // 운저 평원(서쪽 들녘) 의뢰는 운향 게시판으로 이관 — 운향 바로 아래 사냥터라.
  // (id 의 windvale- 접두는 플레이어 진행도 보존을 위해 그대로 두고 regionId 만 옮긴 케이스가 아래로 이어진다.)
  {
    id: "windvale-ash-hounds",
    regionId: "windvale",
    title: "잿빛 협로: 들개 사냥",
    description:
      "잿빛 협로에 잿빛 들개가 들끓고 있습니다. 35마리를 사냥해 주세요.",
    requiredLevel: 34,
    target: { kind: "kill", monsterName: "잿빛 들개", count: 35 },
    reward: { gold: 500, fame: 18, exp: 850 },
    repeatable: true,
  },
  // 바람골 역참 — 봉황령 너머(화산 지대) 의뢰. 길잡이 한솔이 잿빛 협로 의뢰 후 풀어주는 후속.
  // 보스 의뢰는 화산 지대 진입 시점에 미리 받을 수 있어, 천공 성지가 열리기 전부터 보스 도전 동기를 준다.
  {
    id: "windvale-volcano-boss",
    regionId: "windvale",
    title: "능선 너머의 불덩이",
    description:
      "잿빛 협로를 지나 봉황령을 넘으면 화산 지대가 나와요. 거기 깊은 곳에. 사람들이 화산의 심장이라 부르는 게 깨어났습니다. 그놈을 잠재워야 그 너머 천공 성지로 가는 길이 열려요. 부탁 좀 드릴게요.",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "화산의 심장", count: 1 },
    reward: { gold: 2500, fame: 60, exp: 4500 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },
  // 화산 지대 정기 의뢰 — 천공 성지 게시판으로 이관(성지 발치 사냥터). 진행도 보존 위해
  // id 의 windvale- 접두는 그대로. requires 도 윈드밸 길잡이 한솔 라인 그대로 유지.
  {
    id: "windvale-lava-slimes",
    regionId: "skyreach",
    title: "화산 지대: 용암 슬라임 정화",
    description:
      "봉황령 너머 화산 지대에 용암 슬라임이 들끓는다는 소식이 들어왔습니다. 45마리를 정화해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "용암 슬라임", count: 45 },
    reward: { gold: 900, fame: 24, exp: 2700 },
    repeatable: true,
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },
  // ── 운향 — 봉황령 입구 의뢰 ─────────────────────────────────────────────
  // 도연이 봉황령 너머를 경계해 파견 의뢰를 내는 NPC 라인 첫 번째.
  {
    id: "unhyang-guide-phoenix-hunt",
    regionId: "unhyang",
    title: "봉황령의 불꽃 독수리",
    description:
      "봉황령에 불꽃 독수리가 너무 많아. 15마리만 정리해 주면 능선이 좀 안전해질 거야.",
    requiredLevel: 35,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 15 },
    reward: { gold: 800, fame: 26, exp: 1200 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  {
    id: "unhyang-herbalist-flame-scale",
    regionId: "unhyang",
    title: "화염 비늘 여덟",
    description:
      "봉황령 화염 도마뱀의 비늘이 약 달이는 데 쓸 만해요. 8개만 모아다 주시면, 포션 한 보따리 드릴게요.",
    requiredLevel: 35,
    target: { kind: "deliver", materialId: "flame_scale", count: 8 },
    reward: {
      gold: 700,
      exp: 1000,
      potionCapacityBonus: 1,
    },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  // 봉황령 정기 의뢰는 바람골 게시판 단독 — 운향은 자기 사냥터·운저 평원에 집중.
  // (옛 unhyang-phoenix-ridge-patrol / unhyang-board-phoenix-ridge-grand 는 분담 정리로 제거.)

  // ── 천공 성지 — 메인 라인 "능선 너머의 봉인" (원로 해무) ─────────────────
  // 화산의 심장 처치(volcano_heart_defeated, 천공 성지 진입 조건) 후 만나는 라인.
  // 봉황 무구 갑옷·액세서리 확정 제작서 + 성지 "또 다른 봉인" 서사. HaemuDialogue.
  {
    id: "skyreach-haemu-lava-core",
    regionId: "skyreach",
    title: "봉인의 자물쇠",
    description:
      "이 성지에는 화산의 심장 말고도 잠재워 둔 것이 있소. 그 봉인이 아래에서 올라오는 열기에 무뎌졌소. 용암 핵 여섯 개면 자물쇠를 다시 채울 수 있소. 가져다 주면, 봉황 무구를 벼리는 법도 자네 손에 새겨 주리다.",
    requiredLevel: 55,
    target: { kind: "deliver", materialId: "lava_core", count: 6 },
    reward: { gold: 1200, exp: 2500, recipes: ["volcano_armor"] },
    repeatable: false,
    giverNpcId: "skyreach_elder",
  },
  {
    id: "skyreach-haemu-phoenix-feather",
    regionId: "skyreach",
    title: "봉황의 깃",
    description:
      "봉인을 더 단단히 하려면 봉황 깃털 다섯 장이 필요하오. 봉황령의 불꽃 독수리에게서, 혹은 화산의 심장이 떨군 것 중에 있을 게요. 가져오면 봉황주 만드는 법을 더해 주리다.",
    requiredLevel: 55,
    target: { kind: "deliver", materialId: "phoenix_feather", count: 5 },
    reward: { gold: 1400, exp: 3000, recipes: ["volcano_core"] },
    repeatable: false,
    giverNpcId: "skyreach_elder",
    requiresQuestCompleted: "skyreach-haemu-lava-core",
  },
  {
    id: "skyreach-haemu-flame-scale",
    regionId: "skyreach",
    title: "마지막 자물쇠",
    description:
      "마지막이오. 화염 비늘 여덟 장이면 봉인이 완성되오. …이 일을 끝내면, 자네에게 들려줄 이야기가 있소. 북쪽에서 온 순례자를 봤다고 했지? 그 이야기와 무관하지 않소.",
    requiredLevel: 55,
    target: { kind: "deliver", materialId: "flame_scale", count: 8 },
    reward: { gold: 1600, exp: 3500, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "skyreach_elder",
    requiresQuestCompleted: "skyreach-haemu-phoenix-feather",
  },
  {
    id: "skyreach-haemu-weapons",
    regionId: "skyreach",
    title: "봉황 네 자루",
    description:
      "봉인이 채워졌으니. 이제 네 손에 무기를 쥐어 줄 차례요. 봉황 깃털 여덟 장이면, 봉황도·봉황패·봉황극·봉황조, 네 자루 전부 벼리는 법을 자네 손에 새겨 주리다. 손에 맞는 걸 골라 쓰시오.",
    requiredLevel: 55,
    target: { kind: "deliver", materialId: "phoenix_feather", count: 8 },
    reward: { gold: 2500, exp: 3500, recipes: ["volcano_sword", "volcano_shield", "volcano_spear", "volcano_claw"] },
    repeatable: false,
    giverNpcId: "skyreach_elder",
    requiresQuestCompleted: "skyreach-haemu-flame-scale",
  },
  {
    id: "skyreach-volcano-heart-recurring",
    regionId: "skyreach",
    title: "화산의 심장 토벌 ─ 정기",
    description:
      "화산의 심장은 다시 달아오릅니다. 세 번 잠재우면 한동안은 성지 아래가 잠잠할 거예요. 동료를 데려가세요.",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "화산의 심장", count: 3 },
    reward: { gold: 1500, fame: 30, exp: 3000 },
    repeatable: true,
    requiresQuestCompleted: "skyreach-haemu-lava-core",
  },
  // ── 천공 성지 ────────────────────────────────────────────────────────────
  {
    id: "skyreach-guide-knights",
    regionId: "skyreach",
    title: "봉황령 기사 소탕",
    description:
      "봉황령에 모여든 산악 기사들이 성지 순례자들의 발목을 잡고 있어. 20명만 정리해 줘.",
    requiredLevel: 40,
    target: { kind: "kill", monsterName: "산악 기사", count: 20 },
    reward: { gold: 900, fame: 28, exp: 1500 },
    repeatable: false,
    giverNpcId: "skyreach_guide",
  },
  {
    id: "skyreach-alchemist-lava-core",
    regionId: "skyreach",
    title: "용암 핵 다섯",
    description:
      "화산 두꺼비나 불꽃 골렘을 잡으면 가끔 용암 핵이 나와. 5개만 모아다 주면 포션 보유량을 늘려줄게.",
    requiredLevel: 55,
    target: { kind: "deliver", materialId: "lava_core", count: 5 },
    reward: {
      gold: 1200,
      exp: 2900,
      potionCapacityBonus: 1,
    },
    repeatable: false,
    giverNpcId: "skyreach_alchemist",
  },
  // 천공 성지 길드 게시판 — 화산 지대 정기 의뢰 (화산의 심장 처치 후 노출).
  {
    id: "skyreach-flame-golems",
    regionId: "skyreach",
    title: "불꽃 골렘 감시",
    description:
      "화산의 심장이 잠들어도 불꽃 골렘들은 여전해요. 30체를 부숴 주세요.",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "불꽃 골렘", count: 30 },
    reward: { gold: 1000, fame: 26, exp: 2900 },
    repeatable: true,
    requiresQuestCompleted: "windvale-volcano-boss",
  },

  // ════════════════════════════════════════════════════════════════════════
  // 다리 구간 / 봉황령 / 화산 — 사이드 의뢰 + 게시판 (§3.1 §3.3 §4 §5)
  // ════════════════════════════════════════════════════════════════════════

  // ── 바람골 역참 — NPC 전속 사이드 (마로 / 노을 / 한솔) ───────────────────
  {
    id: "windvale-merchant-escort-raiders",
    regionId: "windvale",
    title: "짐수레를 노리는 자들",
    description:
      "내 짐수레를 노리는 약탈자 놈들 좀 떼어내 줘. 열둘이면 한동안은 길이 조용하지.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "떠돌이 약탈자", count: 12 },
    reward: { gold: 400, fame: 16, exp: 650 },
    repeatable: false,
    giverNpcId: "windvale_merchant",
  },
  {
    id: "windvale-merchant-escort-hawks",
    regionId: "windvale",
    title: "초원 매 쫓아내기",
    description:
      "초원 매가 자꾸 짐 위로 내리꽂혀서 깃털이 모이질 않아. 열 마리만 쫓아 주면 길에서 주운 좋은 걸 나눠 드리지.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "초원 매", count: 10 },
    reward: { gold: 380, exp: 600, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "windvale_merchant",
  },
  {
    id: "windvale-merchant-ash-stone",
    regionId: "windvale",
    title: "잿돌 여덟 덩이",
    description:
      "잿돌이 세공 받침에 그만이거든. 여덟 덩이만 모아다 줘. 잿빛 협로 골렘이 가끔 떨군다더라.",
    requiredLevel: 34,
    target: { kind: "deliver", materialId: "ash_stone", count: 8 },
    reward: { gold: 550, exp: 700 },
    repeatable: false,
    giverNpcId: "windvale_merchant",
  },
  {
    id: "windvale-pathfinder-ridge-scout",
    regionId: "windvale",
    title: "봉황령 첫 발: 능선 정찰",
    description:
      "잿빛 협로를 넘으면 봉황령이야. 거기 불꽃 독수리가 능선을 빙빙 돌아. 열둘만 떨어뜨려 주면 첫 발 디딜 데가 생겨.",
    requiredLevel: 38,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 12 },
    reward: { gold: 750, fame: 24, exp: 1100 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },

  // ── 바람골 역참 길드 게시판 (잿빛 협로 + 봉황령·화산 입구 다리 구간) ──
  // 운저 평원 정기 의뢰는 운향 게시판으로 이관(아래쪽).
  // 화산 지대 정기 의뢰는 천공 성지 게시판으로 이관(아래쪽).
  {
    id: "windvale-board-ash-golems",
    regionId: "windvale",
    title: "잿빛 협로: 재먼지 골렘 정리",
    description: "잿빛 협로를 재먼지 골렘이 메우고 있습니다. 30체를 정리해 주세요.",
    requiredLevel: 34,
    target: { kind: "kill", monsterName: "재먼지 골렘", count: 30 },
    reward: { gold: 520, fame: 18, exp: 850 },
    repeatable: true,
  },
  {
    id: "windvale-board-ash-salamanders",
    regionId: "windvale",
    title: "잿빛 협로: 불씨 도롱뇽 진화",
    description: "잿빛 협로에 불씨 도롱뇽이 들끓습니다. 35마리를 진화해 주세요.",
    requiredLevel: 34,
    target: { kind: "kill", monsterName: "불씨 도롱뇽", count: 35 },
    reward: { gold: 480, fame: 17, exp: 800 },
    repeatable: true,
  },
  {
    id: "windvale-board-ash-golems-large",
    regionId: "windvale",
    title: "잿빛 협로: 재먼지 골렘 대규모 정리",
    description: "재먼지 골렘이 협로 전체를 막았습니다. 60체를 정리해 주세요.",
    requiredLevel: 35,
    target: { kind: "kill", monsterName: "재먼지 골렘", count: 60 },
    reward: { gold: 980, fame: 28, exp: 1600 },
    repeatable: true,
  },
  {
    id: "windvale-board-ridge-eagles",
    regionId: "windvale",
    title: "봉황령 입구: 능선 길 확보",
    description: "봉황령 능선에 불꽃 독수리가 들끓습니다. 30마리를 떨어뜨려 길을 확보해 주세요.",
    requiredLevel: 38,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 30 },
    reward: { gold: 700, fame: 22, exp: 1300 },
    repeatable: true,
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },
  {
    id: "windvale-board-volcano-toads",
    regionId: "skyreach",
    title: "화산 입구: 화산 두꺼비 구제",
    description: "화산 지대 어귀에 화산 두꺼비가 들끓습니다. 30마리를 구제해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "화산 두꺼비", count: 30 },
    reward: { gold: 850, fame: 22, exp: 2400 },
    repeatable: true,
    requiresQuestCompleted: "windvale-volcano-boss",
  },

  // ── 봉황령 — 사이드 의뢰 (운향 도연/산하 · 천공 검/시온 출처) ─────────────
  {
    id: "unhyang-guide-flame-lizards",
    regionId: "unhyang",
    title: "봉황령의 화염 도마뱀",
    description:
      "봉황령 능선 바위틈에 화염 도마뱀이 들끓어. 15마리만 정리해 주면 길이 좀 트일 거야.",
    requiredLevel: 38,
    target: { kind: "kill", monsterName: "화염 도마뱀", count: 15 },
    reward: { gold: 800, fame: 26, exp: 1200 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  {
    id: "skyreach-guide-phoenix-eagles",
    regionId: "skyreach",
    title: "봉황령: 불꽃 독수리 솎아내기",
    description:
      "봉황령 능선에 불꽃 독수리가 너무 늘었어. 15마리만 떨어뜨려 줘. 순찰대가 좀 숨통이 트일 거야.",
    requiredLevel: 40,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 15 },
    reward: { gold: 850, fame: 26, exp: 1300 },
    repeatable: false,
    giverNpcId: "skyreach_guide",
  },
  {
    id: "skyreach-alchemist-phoenix-feather",
    regionId: "skyreach",
    title: "봉황 깃털 넷",
    description:
      "봉황 깃털로 점화제를 만들어 봐야겠어. 봉황령 불꽃 독수리에게서 넷만 모아다 줘.",
    requiredLevel: 40,
    target: { kind: "deliver", materialId: "phoenix_feather", count: 4 },
    reward: { gold: 1000, exp: 1800, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "skyreach_alchemist",
  },
  {
    id: "unhyang-herbalist-flame-eagle-cape",
    regionId: "unhyang",
    title: "봉황 망토를 위하여",
    description:
      "봉황령 불꽃 독수리의 깃을 통째로 엮으면 가벼운 망토가 돼요. 20마리만 잡아 주시면, 그 깃으로 짠 봉황 망토를 직접 만들어 드릴게요.",
    requiredLevel: 40,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 20 },
    reward: { gold: 900, exp: 1400, items: [{ id: "flame_eagle_cape", count: 1 }] },
    repeatable: false,
    giverNpcId: "unhyang_herbalist",
  },
  // 봉황령 정기 의뢰(불꽃 독수리·화염 도마뱀·산악 기사)는 바람골 게시판 단독 — 천공은 자기
  // 화산 지대·성지 콘텐츠에 집중. (옛 skyreach-phoenix-ridge-* / skyreach-knight-captain-hunt 제거.)


  // ── 봉황령 → 화산 사이 (reqLv 44~50) — 레벨 공백 보강 ───────────────────
  // 봉황령 콘텐츠(reqLv ~40~42)와 화산 콘텐츠(reqLv 52+) 사이 10레벨 구간을 메운다.
  // 호스트는 이 시점에 도달 가능한 곳: 바람골 역참(게시판·길잡이 한솔) + 운향(도연).
  {
    id: "windvale-board-ridge-knights",
    regionId: "windvale",
    title: "봉황령: 산악 기사 정리",
    description: "봉황령 능선에 산악 기사단이 길목을 점거했습니다. 30명을 정리해 능선 길을 트세요.",
    requiredLevel: 44,
    target: { kind: "kill", monsterName: "산악 기사", count: 30 },
    reward: { gold: 780, fame: 22, exp: 1750 },
    repeatable: true,
    requiresQuestCompleted: "windvale-pathfinder-ridge-scout",
  },
  {
    id: "windvale-board-flame-lizards-large",
    regionId: "windvale",
    title: "봉황령: 화염 도마뱀 대청소",
    description: "봉황령 바위틈마다 화염 도마뱀이 둥지를 텄습니다. 55마리를 정리해 주세요.",
    requiredLevel: 44,
    target: { kind: "kill", monsterName: "화염 도마뱀", count: 55 },
    reward: { gold: 740, fame: 21, exp: 1700 },
    repeatable: true,
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },
  {
    id: "windvale-board-ridge-eagles-large",
    regionId: "windvale",
    title: "봉황령: 불꽃 독수리 대규모 솎기",
    description: "봉황령 능선을 불꽃 독수리 떼가 뒤덮었습니다. 60마리를 솎아내 하늘 길을 트세요.",
    requiredLevel: 46,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 60 },
    reward: { gold: 1000, fame: 27, exp: 2000 },
    repeatable: true,
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },
  {
    id: "windvale-board-lava-foothills",
    regionId: "skyreach",
    title: "화산 어귀: 용암 슬라임 정찰",
    description: "봉황령을 넘으면 화산 지대 어귀다. 용암 슬라임 35마리를 정화해 첫 발 디딜 데를 만드세요.",
    requiredLevel: 48,
    target: { kind: "kill", monsterName: "용암 슬라임", count: 35 },
    reward: { gold: 900, fame: 24, exp: 2200 },
    repeatable: true,
    requiresQuestCompleted: "windvale-pathfinder-ridge-scout",
  },
  // (옛 unhyang-board-phoenix-ridge-grand 는 분담 정리로 제거 — 봉황령은 바람골 단독 운영.)
  {
    id: "windvale-pathfinder-deep-ridge",
    regionId: "windvale",
    title: "봉황령: 능선 더 깊은 곳",
    description:
      "능선에 첫 발은 디뎠지. 근데 더 깊이 들어가니 산악 기사단이 진을 제대로 쳤더라. 스무 명만 치워 주면 그 너머로 가는 길이 보여. 약 주머니 더 키워 줄게.",
    requiredLevel: 46,
    target: { kind: "kill", monsterName: "산악 기사", count: 20 },
    reward: { gold: 950, exp: 2000, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
    requiresQuestCompleted: "windvale-pathfinder-ridge-scout",
  },
  {
    id: "windvale-pathfinder-foothills",
    regionId: "windvale",
    title: "화산 어귀: 불꽃 골렘",
    description:
      "봉황령 능선을 넘으면 화산 지대 어귀야. 거기 불꽃 골렘이 어슬렁대. 광물째 녹아내리는 놈들이라 까다롭지. 열둘만 부숴 주면 화산 지대로 들어서는 길이 트인다.",
    requiredLevel: 50,
    target: { kind: "kill", monsterName: "불꽃 골렘", count: 12 },
    reward: { gold: 1100, fame: 28, exp: 2400 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
    requiresQuestCompleted: "windvale-pathfinder-deep-ridge",
  },
  {
    id: "unhyang-guide-ridge-storm",
    regionId: "unhyang",
    title: "봉황령: 화염 도마뱀 둥지",
    description:
      "봉황령 바위틈에 화염 도마뱀이 또 둥지를 텄어. 열여덟만 정리해 주면 순례길이 한동안 트일 거야.",
    requiredLevel: 44,
    target: { kind: "kill", monsterName: "화염 도마뱀", count: 18 },
    reward: { gold: 850, fame: 22, exp: 1700 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
    requiresQuestCompleted: "unhyang-guide-flame-lizards",
  },

  // ── 화산 지대 — 사이드 의뢰 (천공 검/시온 출처) ─────────────────────────
  {
    id: "skyreach-alchemist-flame-scale",
    regionId: "skyreach",
    title: "화염 비늘 여덟 (연금)",
    description:
      "비늘에서 내열제를 추출해야 해. 봉황령 화염 도마뱀의 비늘 여덟 장만 모아다 줘.",
    requiredLevel: 52,
    target: { kind: "deliver", materialId: "flame_scale", count: 8 },
    reward: { gold: 1100, exp: 2600, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "skyreach_alchemist",
  },
  {
    id: "skyreach-volcanic-toads",
    regionId: "skyreach",
    title: "화산 지대 순찰: 화산 두꺼비",
    description: "화산 지대 웅덩이 가에 화산 두꺼비가 다시 들끓습니다. 30마리를 정리해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "화산 두꺼비", count: 30 },
    reward: { gold: 850, fame: 22, exp: 2400 },
    repeatable: true,
  },
  {
    id: "skyreach-lava-slimes-2",
    regionId: "skyreach",
    title: "화산 지대 순찰: 용암 슬라임",
    description: "화산 지대에 용암 슬라임이 들끓습니다. 40마리를 정화해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "용암 슬라임", count: 40 },
    reward: { gold: 800, fame: 20, exp: 2300 },
    repeatable: true,
    requiresQuestCompleted: "windvale-volcano-boss",
  },

  // ════════════════════════════════════════════════════════════════════════
  // 보스 누적 사냥 라인 + 액세서리 확정 루트 (§10) — "보스 사냥꾼" 칭호
  // 세 hunter 의뢰는 그 보스를 처음 소개한 NPC 가 다시 주는 "개인 도전"(길드판 미노출).
  // ════════════════════════════════════════════════════════════════════════
  {
    id: "deep-cave-hunter",
    regionId: "village",
    title: "광맥의 수호자 ─ 사냥 기록",
    description:
      "그놈을 열 번이나 잠재우면 동굴 안쪽이 한동안 조용하다고들 하더라고. 나야 무서워서 못 가지만. 모험가 양반이라면 기록 한번 채워볼 만하지 않겠어?",
    requiredLevel: 6,
    target: { kind: "kill", monsterName: "광맥의 수호자", count: 10 },
    reward: { gold: 1500, fame: 30, exp: 1800 },
    repeatable: false,
    giverNpcId: "village_woodcutter_jimmy",
    requiresQuestCompleted: "village-jimmy-deep-cave",
  },
  {
    id: "peak-giant-hunter",
    regionId: "unhyang",
    title: "운봉의 거인 ─ 사냥 기록",
    description:
      "거인을 열 번 잠재운 무리는 산정의 노래에 이름이 남는다네. 동료들과 함께 그 기록을 채워 보겠나?",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "운봉의 거인", count: 10 },
    reward: { gold: 2500, fame: 50, exp: 5000 },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  // 백운 — 거인 10회 처치 후 풀리는 히든 검결 라인. "산정 검결의 잔편" — 봉황 깃털 ×5 deliver.
  // 보상은 book_heaven_slay (귀속). 다이얼로그 게이트: peak-giant-hunter 완료 여부로 노출.
  {
    id: "unhyang-baekun-heaven-slay",
    regionId: "unhyang",
    title: "산정 검결의 잔편",
    description:
      "산정의 노래에 자네 이름이 새겨졌으니, 이제 옛 검결의 잔편을 자네에게 넘길 때가 됐어. 봉황 깃털 다섯. 진짜 불을 머금은 깃이라야 검결을 새길 수 있어. 가져와 주게.",
    requiredLevel: 30,
    target: { kind: "deliver", materialId: "phoenix_feather", count: 5 },
    reward: { fame: 50, skillBooks: ["book_heaven_slay"] },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    requiresQuestCompleted: "peak-giant-hunter",
    hidden: true,
  },
  // 백운 — 천살 잔편 이후 두 번째 히든 라인. 폭풍 일격 — 돌풍 정령 ×10 처치.
  // 다이얼로그 게이트: unhyang-baekun-heaven-slay 완료 여부.
  {
    id: "unhyang-baekun-storm-strike",
    regionId: "unhyang",
    title: "구름 위의 결",
    description:
      "산정의 바람은 한 자루 결로 옮길 수 있다. 옛말이지. 돌풍 정령 열을 잠재워 보게. 자네 검에 그 결이 옮겨질 거야.",
    requiredLevel: 30,
    target: { kind: "kill", monsterName: "돌풍 정령", count: 10 },
    reward: { fame: 50, skillBooks: ["book_storm_strike"] },
    repeatable: false,
    giverNpcId: "unhyang_elder",
    requiresQuestCompleted: "unhyang-baekun-heaven-slay",
    hidden: true,
  },
  // 음유시인 — 유실품 노래(bard_lucky_collected) 이후 히든 호흡 라인. 봉황 깃털 ×3 deliver.
  // 다이얼로그 게이트: bard_lucky_collected 플래그 보유.
  {
    id: "windvale-bard-focused-breath",
    regionId: "windvale",
    title: "한 호흡의 결",
    description:
      "노래는 한 호흡으로 끝나야 결이 잡혀. 봉황 깃털 세 개만 가져다 줘. 그걸로 한 호흡의 결을 자네 검에 옮겨 줄게.",
    requiredLevel: 25,
    target: { kind: "deliver", materialId: "phoenix_feather", count: 3 },
    reward: { fame: 40, skillBooks: ["book_focused_breath"] },
    repeatable: false,
    giverNpcId: "windvale_bard",
    hidden: true,
  },
  // 카이 — pristine 호수 님프 의뢰 완료 후 풀리는 히든 라인. 요정 가루 ×10 deliver → 잔상.
  {
    id: "diola-kai-afterimage",
    regionId: "diola",
    title: "닿기 전의 결",
    description:
      "노랫소리에 만져지기 전에. 그게 결이에요. 요정 가루 열 점만 모아 주시면, 새벽 그물에 비친 잔상의 결을 자네 검에 옮겨 줄게요.",
    requiredLevel: 12,
    target: { kind: "deliver", materialId: "fairy_dust", count: 10 },
    reward: { fame: 35, skillBooks: ["book_afterimage"] },
    repeatable: false,
    giverNpcId: "diola_fisher",
    requiresQuestCompleted: "diola-kai-pristine-nymphs",
    hidden: true,
  },
  {
    id: "volcano-heart-hunter",
    regionId: "skyreach",
    title: "화산의 심장 ─ 사냥 기록",
    description:
      "그것을 열 번이나 잠재운 자가 있었다는 옛 기록이 성지에 남아 있어. 솜씨가 있다면. 자네가 그 기록을 다시 써 보겠어?",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "화산의 심장", count: 10 },
    reward: { gold: 3500, fame: 50, exp: 6000 },
    repeatable: false,
    giverNpcId: "skyreach_guide",
    requiresQuestCompleted: "windvale-volcano-boss",
  },
  {
    id: "skyreach-alchemist-heart-essence",
    regionId: "skyreach",
    title: "심장에서 나온 것",
    description:
      "화산의 심장을 잠재울 때마다 떨어지는 것들. 용암 핵. 그걸로 봉인 보강제를 만들어 봐야겠어. 열 개만 모아다 줘.",
    requiredLevel: 55,
    target: { kind: "deliver", materialId: "lava_core", count: 10 },
    reward: { gold: 2000, exp: 3500, potionCapacityBonus: 1 },
    repeatable: true,
    cooldownMs: 12 * 60 * 60 * 1000,
    requiresQuestCompleted: "windvale-volcano-boss",
  },

  // ════════════════════════════════════════════════════════════════════════
  // 히든 퀘스트 (§11) — 길드 게시판 미노출(giverNpcId 지정). 추가 노출 조건
  // (아이템 보유 / 보스 N회 처치 / flag) 은 해당 NPC 다이얼로그가 직접 가드한다.
  // ════════════════════════════════════════════════════════════════════════
  {
    id: "hidden-mole-king",
    regionId: "village",
    title: "두더지왕의 흔적",
    description:
      "두더지왕이 진짜 있다고? …그 드릴을 들고 다니는 걸 보니 빈말은 아닌 모양이군. 평야 두더지를 백 마리쯤 잡아보면 흔적이 나올지도 모르지.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName: "두더지", count: 100 },
    reward: { gold: 800, fame: 10, exp: 1200, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "village_woodcutter_jimmy",
    hidden: true,
  },
  {
    id: "hidden-deepest-vein",
    regionId: "village",
    title: "광맥의 끝",
    description:
      "광맥의 수호자를 그렇게 여러 번 잠재웠으면, 동굴 안쪽 더 깊은 데서 마정석이 진하게 고였을 거다. 스무 덩이만 가져와 봐. 광맥의 끝이 어디까지 뻗었는지, 그걸로 가늠해 보자.",
    requiredLevel: 6,
    target: { kind: "deliver", materialId: "mana_crystal", count: 20 },
    reward: { gold: 1200, exp: 1800, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "village_blacksmith_bold",
    requiresQuestCompleted: "deep-cave-hunter",
    hidden: true,
  },
  {
    id: "hidden-blacksmith-duel",
    regionId: "village",
    title: "마저 두드린 것",
    description:
      "옛날에 만월이랑 무기 하나를 절반씩 만들다 싸우고 헤어졌지. 둘 다 다시 만났으니… 마저 완성해 볼까 싶어. 단단한 결정 여덟 덩이만 가져와 봐. 완성되면. 그 검은 자네 거야.",
    requiredLevel: 22,
    target: { kind: "deliver", materialId: "hard_crystal", count: 8 },
    reward: { gold: 1500, exp: 2500, items: [{ id: "moonlight_blade", count: 1 }] },
    repeatable: false,
    giverNpcId: "village_blacksmith_bold",
    hidden: true,
  },
  {
    id: "hidden-giants-origin",
    regionId: "unhyang",
    title: "거인은 어디서 왔나",
    description:
      "거인이 어디서 왔는지 알고 싶나? …협곡 가장 깊은 곳, 돌풍 정령이 모이는 자리를 봐라. 예순쯤 흩어 놓으면 그 자리가 드러난다. 그 다음은. 내가 본 것을 말해주지.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "돌풍 정령", count: 60 },
    reward: { gold: 1200, fame: 20, exp: 2000 },
    repeatable: false,
    giverNpcId: "unhyang_pilgrim",
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
    hidden: true,
  },
  {
    id: "hidden-volcano-relic",
    regionId: "skyreach",
    title: "심장이 잠든 자리",
    description:
      "심장이 잠든 자리에 정수가 고였더군. 화산 두꺼비를 충분히 잡으면 그 정수가 흘러나올 거야. 마흔 마리쯤이면 돼. 그걸로. 용암 정수를 다듬어 줄게. 자네 몫이야.",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "화산 두꺼비", count: 40 },
    reward: { gold: 1500, exp: 2500, items: [{ id: "lava_essence", count: 1 }] },
    repeatable: false,
    giverNpcId: "skyreach_alchemist",
    requiresQuestCompleted: "windvale-volcano-boss",
    hidden: true,
  },

  // ── 히든: 순례자의 자취 (§11.1) — 운저 평원→잿빛 협로→봉황령 표식 추적 ──────
  // unhyang_main_cleared 후 순례자가 운향을 떠나며 길마다 표식을 남긴다. 각 지역에서
  // PilgrimMarkDialogue("알림판" 카드 → 다이얼로그)로 surfacing. 4단계(천공 성지 재회)는
  // 의뢰 없이 step-3 완료 + skyreach 도착 시 PilgrimMarkDialogue 가 처리 → pilgrim_revealed.
  // giverNpcId 없음 — 운저 평원·잿빛 협로·봉황령은 게시판이 없는 통과 지역이라 게시판 노출 안 됨.
  {
    id: "hidden-pilgrim-trail-1",
    regionId: "cloud_plain",
    title: "순례자의 자취 ─ 풀밭의 매듭",
    description:
      "풀밭 한가운데 돌무지 위에 낯선 매듭이 묶여 있다. 순례자가 묶은 거다. 옆에는 떠돌이 약탈자들의 야영지. 길을 트지 않으면 다음 표식을 찾을 수 없다. 열 명만 정리하자.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "떠돌이 약탈자", count: 10 },
    reward: { gold: 600, fame: 12, exp: 900 },
    repeatable: false,
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  {
    id: "hidden-pilgrim-trail-2",
    regionId: "ashen_pass",
    title: "순례자의 자취 ─ 잿더미의 매듭",
    description:
      "잿더미에 반쯤 묻힌 같은 매듭. 옆에 식은 모닥불 자리, 그 둘레에 잿돌이 흩어져 있다. 다섯 덩이를 주워 표식 위에 올려놓으면. 잿가루 사이로 순례자가 간 방향이 드러난다.",
    requiredLevel: 34,
    target: { kind: "deliver", materialId: "ash_stone", count: 5 },
    reward: { gold: 800, fame: 14, exp: 1200 },
    repeatable: false,
    requiresQuestCompleted: "hidden-pilgrim-trail-1",
  },
  {
    id: "hidden-pilgrim-trail-3",
    regionId: "phoenix_ridge",
    title: "순례자의 자취 ─ 능선의 매듭",
    description:
      "능선 바위에 새겨진 매듭 문양. 디올라 후드 손님이 준 표식과 같은 모양이다. 순례자가 산악 기사들에게 길을 막혔던 듯. 열둘만 정리하면 능선 너머로 가는 자취가 이어진다.",
    requiredLevel: 38,
    target: { kind: "kill", monsterName: "산악 기사", count: 12 },
    reward: { gold: 1000, fame: 18, exp: 1500 },
    repeatable: false,
    requiresQuestCompleted: "hidden-pilgrim-trail-2",
  },
  // ── 별바다 — 노수호자 유성의 사냥 의뢰 라인 (4단). ────────────────────────
  // 1차 출처: 떠도는 시녀(Lv75) → 별빛 망령(Lv75) → 별궤도 자율기(Lv75) → 황성 호위병(Lv85).
  // 보상: 4단으로 corridor 5종 + road 5종 제작서 전부 풀린다 (5단 craft chain 의 중간 출처).
  {
    id: "star-haven-corridor-scouts",
    regionId: "star_corridor",
    title: "회랑의 흩어진 별빛",
    description:
      "별바다 노수호자 유성의 첫 부탁. 회랑에 떠도는 시녀들의 잔영이 별빛 흐름을 흩어 놓고 있다. 열둘만 가라앉히면 회랑검과 회랑 방패 벼림법을 넘겨준다.",
    requiredLevel: 75,
    target: { kind: "kill", monsterName: "떠도는 시녀", count: 12 },
    reward: { gold: 1200, fame: 18, exp: 2800, recipes: ["corridor_blade", "corridor_aegis"] },
    repeatable: false,
    giverNpcId: "star_haven_elder",
  },
  {
    id: "star-haven-corridor-wraiths",
    regionId: "star_corridor",
    title: "망령을 풀어내라",
    description:
      "회랑 깊은 곳에 별빛 망령들이 옛 흐름을 묶어두고 있다. 열다섯만 풀어주면 회랑창과 회랑 너클 벼림법을 함께 넘겨준다.",
    requiredLevel: 76,
    target: { kind: "kill", monsterName: "별빛 망령", count: 15 },
    reward: { gold: 1500, fame: 20, exp: 3400, recipes: ["corridor_lance", "corridor_grip"] },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-corridor-scouts",
  },
  {
    id: "star-haven-corridor-golems",
    regionId: "star_corridor",
    title: "회랑의 봉인",
    description:
      "별궤도 자율기들이 옛 회랑의 봉인을 쥐고 있다. 열만 가라앉히면 회랑 망토 벼림법과 안에 굳어 있는 별의 정수까지 함께 받는다.",
    requiredLevel: 78,
    target: { kind: "kill", monsterName: "별궤도 자율기", count: 10 },
    reward: {
      gold: 1900,
      fame: 24,
      exp: 4200,
      recipes: ["corridor_mantle"],
      materials: [{ id: "stellar_essence", count: 3 }],
    },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-corridor-wraiths",
  },
  // 폐도의 봉인 — 천공인의 왕 서사 게이트. 2026-05-19 보스 솔로 전환 이후에도
  // 의뢰는 서사 흐름과 storyFlag `skyfolk_gate_cleared` 설정용으로 유지.
  // 회랑 골렘(Q3) 완수 후 노출 / 완료 시 storyFlag `skyfolk_gate_cleared` 셋.
  {
    id: "star-haven-skyfolk-gate",
    regionId: "skyfolk_ruins",
    title: "폐도의 봉인을 풀어라",
    description:
      "폐도 안쪽 깊이 잘못 굳어 있는 봉인을 더는 둘 수 없다. 천공인 사관의 잔재 열만 정리하면 천공인의 왕이 비로소 자네를 마주할 자격을 인정한다.",
    requiredLevel: 80,
    target: { kind: "kill", monsterName: "천공인 사관", count: 10 },
    reward: { gold: 1700, fame: 22, exp: 3800 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-corridor-golems",
  },
  {
    id: "star-haven-throne-guards",
    regionId: "throne_road",
    title: "옥좌의 길목: 황성의 길",
    description:
      "옥좌의 길에서 황성 호위병들이 길을 막고 있다. 열다섯만 정리해 길을 열면 황성 무구 다섯 자루 벼림법을 모두 넘겨준다. 별바다가 줄 수 있는 마지막 선물.",
    requiredLevel: 85,
    target: { kind: "kill", monsterName: "황성 호위병", count: 15 },
    reward: {
      gold: 3500,
      fame: 40,
      exp: 7500,
      recipes: ["road_blade", "road_aegis", "road_lance", "road_grip", "road_mantle"],
    },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-skyfolk-gate",
  },
  // 옥좌의 봉인 — 창공의 주재 서사 게이트. Chapter 24 의 완료 룰이 이 flag 를 본다.
  // 2026-05-19 보스 솔로 전환 이후에도 의뢰는 챕터 진행용으로 필수.
  // 황성 호위병(Q4 throne-guards) 완수 후 노출 / 완료 시 storyFlag `apex_gate_cleared` 셋.
  {
    id: "star-haven-apex-gate",
    regionId: "apex_throne",
    title: "옥좌의 봉인을 풀어라",
    description:
      "옥좌 둘레에 별빛 사도들이 마지막 봉인을 두르고 있다. 열만 가라앉히면 창공의 주재가 자네 앞에 일어선다. 별빛이 그날을 기억할 것이다.",
    requiredLevel: 90,
    target: { kind: "kill", monsterName: "별빛 사도", count: 10 },
    reward: { gold: 3000, fame: 36, exp: 6500 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-throne-guards",
  },
  // ────────────────────────────────────────────────────────────────────────
  // 노수호자 유성 — 후반 3 보스(별을 지키는 자 / 천공인의 왕 / 창공의 주재) 도전 의뢰.
  // 2026-05-19: 세 보스가 협동→솔로 전환되면서 coop_* 타깃 9종을 솔로 전투 가능한
  // kind 로 재구성. 게이트 의뢰 완료(=서사 게이트) 후 잠금 해제.
  //   - witness : kill ×1                          (서사상 첫 베어냄 인증)
  //   - strike  : kill_within_hp 0.7 ×3            (거의 무피로 처치 — 결단의 일격)
  //   - survive : no_potion_boss ×5                (포션 없이 처치 — 흔들림 없는 자세)
  // 보상 fame 양은 보존 (협동→솔로 전환만, 진입장벽 동등).
  // ────────────────────────────────────────────────────────────────────────
  // 별을 지키는 자 (starspire) 3종
  {
    id: "star-haven-keeper-challenge-witness",
    regionId: "starspire",
    title: "별을 지키는 자: 별빛의 증인",
    description:
      "별을 지키는 자를 한 번 거두어 별빛이 자네를 알아보게 하시오. 별빛이 자네를 한 번 깊이 알아본다면. 그 기억은 평생 간다.",
    requiredLevel: 70,
    target: { kind: "kill", monsterName: "별을 지키는 자", count: 1 },
    reward: { fame: 50 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-corridor-golems",
  },
  {
    id: "star-haven-keeper-challenge-strike",
    regionId: "starspire",
    title: "별을 지키는 자: 별빛 한 줄기",
    description:
      "별을 지키는 자를 거의 다치지 않은 채로 세 번 거두시오. 한 번에 깊이 가르는 자에게만 보이는 자리가 있다.",
    requiredLevel: 70,
    target: {
      kind: "kill_within_hp",
      monsterName: "별을 지키는 자",
      minHpFraction: 0.7,
      count: 3,
    },
    reward: { fame: 50 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-corridor-golems",
  },
  {
    id: "star-haven-keeper-challenge-survive",
    regionId: "starspire",
    title: "별을 지키는 자: 흔들리지 않는 자세",
    description:
      "포션을 단 한 병도 꺼내지 말고 별을 지키는 자를 다섯 번 거두시오. 흔들리지 않는 자세가 별빛에 새겨질 때까지.",
    requiredLevel: 70,
    target: { kind: "no_potion_boss", monsterName: "별을 지키는 자", count: 5 },
    reward: { fame: 50 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-corridor-golems",
  },
  // 천공인의 왕 (skyfolk_ruins) 3종
  {
    id: "star-haven-king-challenge-witness",
    regionId: "skyfolk_ruins",
    title: "천공인의 왕: 폐도의 증인",
    description:
      "천공인의 왕을 한 번 거두어 폐도가 자네를 알아보게 하시오. 폐도가 자네를 알아보는 첫 표식이다.",
    requiredLevel: 80,
    target: { kind: "kill", monsterName: "천공인의 왕", count: 1 },
    reward: { fame: 60 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-skyfolk-gate",
  },
  {
    id: "star-haven-king-challenge-strike",
    regionId: "skyfolk_ruins",
    title: "천공인의 왕: 폐도의 일격",
    description:
      "천공인의 왕을 거의 다치지 않은 채로 세 번 거두시오. 폐도가 한 자루 칼에도 흔들리는 순간이 있다.",
    requiredLevel: 80,
    target: {
      kind: "kill_within_hp",
      monsterName: "천공인의 왕",
      minHpFraction: 0.7,
      count: 3,
    },
    reward: { fame: 60 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-skyfolk-gate",
  },
  {
    id: "star-haven-king-challenge-survive",
    regionId: "skyfolk_ruins",
    title: "천공인의 왕: 폐도를 견디는 자",
    description:
      "포션을 단 한 병도 꺼내지 말고 천공인의 왕을 다섯 번 거두시오. 폐도는 견디는 자만이 풀어낼 수 있다.",
    requiredLevel: 80,
    target: { kind: "no_potion_boss", monsterName: "천공인의 왕", count: 5 },
    reward: { fame: 60 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-skyfolk-gate",
  },
  // 창공의 주재 (apex_throne) 3종
  {
    id: "star-haven-arbiter-challenge-witness",
    regionId: "apex_throne",
    title: "창공의 주재: 옥좌의 증인",
    description:
      "창공의 주재를 한 번 거두어 옥좌가 자네를 알아보게 하시오. 옥좌가 자네를 처음으로 깊이 인정하는 표식이다.",
    requiredLevel: 90,
    target: { kind: "kill", monsterName: "창공의 주재", count: 1 },
    reward: { fame: 80 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-apex-gate",
  },
  {
    id: "star-haven-arbiter-challenge-strike",
    regionId: "apex_throne",
    title: "창공의 주재: 옥좌의 일격",
    description:
      "창공의 주재를 거의 다치지 않은 채로 세 번 거두시오. 옥좌도 한 자루 칼에 흔들리는 순간이 있다 들었소.",
    requiredLevel: 90,
    target: {
      kind: "kill_within_hp",
      monsterName: "창공의 주재",
      minHpFraction: 0.7,
      count: 3,
    },
    reward: { fame: 80 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-apex-gate",
  },
  {
    id: "star-haven-arbiter-challenge-survive",
    regionId: "apex_throne",
    title: "창공의 주재: 옥좌를 견디는 자",
    description:
      "포션을 단 한 병도 꺼내지 말고 창공의 주재를 다섯 번 거두시오. 옥좌를 견디는 자만이 별빛의 끝을 본다.",
    requiredLevel: 90,
    target: { kind: "no_potion_boss", monsterName: "창공의 주재", count: 5 },
    reward: { fame: 80 },
    repeatable: false,
    giverNpcId: "star_haven_elder",
    requiresQuestCompleted: "star-haven-apex-gate",
  },
  // ── 5막 「빈 옥좌의 시대」 PR-C — 별빛을 담을 그릇 ───────────────────────────
  // 노수호자 유성(시작 마을 인스턴스, village_pilgrim_meteor) 의 단일 deliver 의뢰.
  // dialogue 가 endgame_apex_defeated + Ch 27 완료(세 잔영 flag) 를 가드 — 데이터로
  // 표현 불가하므로 hidden:true (게시판 노출 X, NPC 대화로만 발견).
  // 보상: 별빛 깃든 기예 6권 일괄. 의뢰 완료가 Ch 28 「유성의 마지막 부탁」 의 완료 조건.
  {
    id: "village-meteor-vessel",
    regionId: "village",
    title: "별빛을 담을 그릇",
    description:
      "별바다에서 시작 마을까지 직접 찾아온 노수호자 유성. 옛 봉인 자리 셋에서 거두어진 별빛 조각 30점을 가져가면, 누구의 것도 아닌 빛을 누구의 것도 아닌 자리에 두기 위한 마지막 그릇을 빚어 두겠다고 한다.",
    requiredLevel: 100,
    target: { kind: "deliver", materialId: "starfall_shard", count: 30 },
    reward: {
      gold: 5000,
      fame: 50,
      exp: 5000,
      skillBooks: [
        "book_starlit_mending",
        "book_starlit_cut",
        "book_starlit_knot",
        "book_starlit_chill",
        "book_starlit_sever",
        "book_starlit_scatter",
      ],
    },
    repeatable: false,
    giverNpcId: "village_pilgrim_meteor",
    hidden: true,
  },
  // 5막 깊이 — 지미 히든. 별빛 광맥 수호자 5회 처치로 풀리는 호흡법(book_lifesteal).
  // 다이얼로그 게이트: storyFlags.has("starfall_warden_felled") — 별빛 광맥 수호자를
  // 한 번이라도 베어 본 자에게만 지미가 운을 뗀다. 보상은 흡령(귀속).
  {
    id: "village-jimmy-starfall-deepening",
    regionId: "village",
    title: "별빛 광맥의 깊이",
    description:
      "광맥의 수호자가 별빛에 데워져 다시 깨어났다는 말. 자네가 봤다지. 사람들은 안 믿어. 다섯 번이면. 다섯 번을 거두어 와 주면, 노친네가 옛 광맥 호흡법 한 자락을 자네 결에 옮겨 둘 테니까.",
    requiredLevel: 100,
    target: { kind: "kill", monsterName: "별빛 광맥 수호자", count: 5 },
    reward: { gold: 3000, fame: 40, exp: 4000, skillBooks: ["book_lifesteal"] },
    repeatable: false,
    giverNpcId: "village_woodcutter_jimmy",
    hidden: true,
  },
];

// 길드 게시판 노출용 — NPC 전속 퀘스트는 제외, kill 형만 노출.
// (deliver 형은 NPC 대화에서만 진행되므로 길드 게시판에 보이지 않는다.)
export type KillQuest = Quest & { target: { kind: "kill"; monsterName: string; count: number } };

export function getQuestsForRegion(regionId: RegionId): KillQuest[] {
  return QUESTS.filter(
    (q): q is KillQuest =>
      q.target.kind === "kill" && q.regionId === regionId && !q.giverNpcId,
  );
}

export function getQuestById(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}
