import type { ItemId } from "./items";
import type { MaterialId } from "./materials";
import type { NpcId } from "./npcs";
import type { PotionId } from "./potions";
import type { RegionId } from "./world";

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
};

// 의뢰 목표 — 두 종류:
// - "kill"   : 지정 몬스터를 N마리 처치. 진행도는 storage 의 progress 에 누적.
// - "deliver": 지정 재료를 N개 모아 의뢰주(NPC)에게 직접 건넨다. 진행도는 별도
//              저장하지 않고, NPC 대화에서 인벤토리 잔량을 보고 즉시 판정·소비한다.
export type QuestTarget =
  | { kind: "kill"; monsterName: string; count: number }
  | { kind: "deliver"; materialId: MaterialId; count: number };

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
};

export const REPEAT_COOLDOWN_MS_DEFAULT = 6 * 60 * 60 * 1000;

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
    title: "훈련 — 슬라임 5마리",
    description: "훈련 교관 스미스의 첫 과제. 평야의 슬라임 5마리를 처치한다.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"슬라임", count: 5 },
    reward: {
      potions: [{ id: "potion_heal_s", count: 5 }],
      recipes: ["potion_heal_s"],
    },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
  },
  {
    id: "village-trainer-dogs",
    regionId: "village",
    title: "훈련 — 들개 10마리",
    description: "훈련 교관 스미스의 두 번째 과제. 들개 10마리를 처치한다.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"들개", count: 10 },
    reward: { exp: 30, gold: 15, fame: 3 },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
  },
  {
    id: "village-trainer-moles",
    regionId: "village",
    title: "훈련 — 두더지 10마리",
    description: "훈련 교관 스미스의 마지막 과제. 두더지 10마리를 처치한다.",
    requiredLevel: 1,
    target: { kind: "kill", monsterName:"두더지", count: 10 },
    reward: {
      items: [{ id: "vitality_ring", count: 1 }],
    },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
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
  },
  {
    id: "diola-boro-spider-silk",
    regionId: "diola",
    title: "보로의 거미줄",
    description:
      "거미줄 재고가 자꾸 모자랍니다. 30개만 모아 주시면, 답례로 골드와 명성을 두둑이 드리지요.",
    requiredLevel: 5,
    target: { kind: "deliver", materialId: "spider_silk", count: 30 },
    reward: { gold: 180, fame: 15, exp: 300 },
    repeatable: false,
    giverNpcId: "diola_merchant",
  },
  // 마린 — 트라이얼 통과 후 폐허가 열리고 나서야 진행 가능 (영혼 결정은 망령 드롭).
  // 완료 시 '디올라의 친구' 칭호를 부여하는 라인의 클로저.
  {
    id: "diola-marin-soul-crystals",
    regionId: "diola",
    title: "촌장의 청 — 영혼 결정",
    description:
      "폐허에서 나온 영혼 결정 3개만 가져다주시오. 옛 기록에 따르면, 이 마을과 폐허의 매듭을 푸는 데 그게 필요하다고 했소.",
    requiredLevel: 9,
    target: { kind: "deliver", materialId: "soul_crystal", count: 3 },
    reward: { gold: 300, fame: 15, exp: 600 },
    repeatable: false,
    giverNpcId: "diola_elder",
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
  // ── 운향 ────────────────────────────────────────────────────────────────
  // 백운 (메인 라인) 의뢰는 운봉의 거인 보스가 들어온 후 추가. 지금은 사이드만.
  {
    id: "unhyang-doyeon-wolves",
    regionId: "unhyang",
    title: "협곡의 무리",
    description:
      "협곡의 절벽 늑대가 너무 늘었어. 10마리만 정리해 주면 산이 좀 조용해질 거야.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 10 },
    reward: { gold: 360, fame: 18, exp: 600 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  {
    id: "unhyang-sanha-herbs",
    regionId: "unhyang",
    title: "산초꽃 채집",
    description:
      "산기슭에 피는 산초꽃이 필요해요. 8송이만 모아다 주시면, 약 만드는 솜씨로 보답할게요.",
    requiredLevel: 18,
    target: { kind: "deliver", materialId: "sancho_blossom", count: 8 },
    reward: { gold: 300, exp: 450, potionCapacityBonus: 1 },
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
