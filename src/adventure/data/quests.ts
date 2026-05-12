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

const H = 60 * 60 * 1000;
// 지역별 반복 의뢰 기본 쿨다운. 우선순위: quest.cooldownMs > 이 맵 > REPEAT_COOLDOWN_MS_DEFAULT.
// 초반 마을은 짧게(빌드/명성/골드 빨리), 후반 지역은 길게(반복 효율 억제).
export const REGION_REPEAT_COOLDOWN_MS: Partial<Record<RegionId, number>> = {
  village: 3 * H,
  diola: 6 * H,
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
  // 볼드 — 마정석 무기 라인 보조(§10.1). 광맥의 수호자 드롭(마정석)을 볼드가 시연 → 팔찌 제작서.
  // BlacksmithDialogue 에서 노출 (jimmy_deep_cave_quest flag 가 켜진 뒤 — 동굴 안쪽을 안다는 신호).
  {
    id: "village-bold-mana-crystal",
    regionId: "village",
    title: "마정석을 다루는 법",
    description:
      "광맥의 수호자가 떨군 마정석, 그거 제대로 다루려면 손이 익어야 해. 다섯 덩이만 가져와 봐 — 그걸로 시연을 보여주지. 보고 나면 자네도 마정석 무기를 벼릴 수 있을 거야.",
    requiredLevel: 6,
    target: { kind: "deliver", materialId: "mana_crystal", count: 5 },
    reward: { gold: 600, exp: 500, recipes: ["mana_bracelet"], potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "village_blacksmith_bold",
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
      "폐허에서 나온 영혼 결정 3개만 가져다주시오. 옛 기록에 따르면, 이 마을과 폐허의 매듭을 푸는 데 그게 필요하다고 했소. …그리고 그 결정으로 칼을 벼리는 법도 적혀 있더군. 도면도 함께 가져가시오.",
    requiredLevel: 9,
    target: { kind: "deliver", materialId: "soul_crystal", count: 3 },
    reward: { gold: 300, fame: 15, exp: 600, recipes: ["soul_blade"] },
    repeatable: false,
    giverNpcId: "diola_elder",
  },
  // 마린 ↔ 백운 — 산정 교역로 개통(§7.2). 운향 백운 라인의 mountain_trade_open flag 가
  // 켜진 뒤 MarinDialogue 에서 노출. 완료 시 diola_unhyang_trade_done flag → 양 마을 갱신.
  {
    id: "diola-marin-mountain-trade",
    regionId: "diola",
    title: "산정과의 거래",
    description:
      "산정 길이 다시 안전해졌다고 들었소. 그렇다면 거래를 트지 — 우리 쪽 길목도 정리가 필요하오. 폐허 어귀 늑대 서른 마리만 솎아 주시오. 그러면 디올라와 운향 사이로 짐수레가 다시 오갈 게요.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "폐허 늑대", count: 30 },
    reward: { gold: 700, fame: 26, exp: 1100, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "diola_elder",
    requiresQuestCompleted: "unhyang-baekun-highland-goats",
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
  },
  {
    id: "unhyang-baekun-peak-giant",
    regionId: "unhyang",
    title: "운봉의 거인",
    description:
      "이제 알겠네 — 산 깊은 곳에 잠들지 않는 것이 버티는 한, 이 산정은 평온할 수 없어. 운봉의 거인. 혼자선 어림없는 상대지. 동료를 모아 그놈을 잠재워 주게. 산정의 명운이 거기 달렸다네.",
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
      "거인이 잠든 지금이 기회야. 협곡 길에 절벽 늑대가 너무 많아 짐꾼들이 다니질 못해. 서른 마리만 솎아 주게 — 디올라와 다시 거래를 트려면 길부터 안전해야 하니.",
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
      "산기슭 비탈은 산양 떼가 바위를 굴려대서 위험하다네. 마흔 마리만 정리해 주게 — 그래야 아랫마을 짐수레가 비탈을 오를 수 있어.",
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
  // 만월 — "운봉석을 벼리는 법". 견갑(peak_mantle) 제작서 확정 입수 루트.
  // 운봉 무기 4종은 그대로 운봉의 거인 보스 드롭(recipe_one_of)으로 둔다.
  {
    id: "unhyang-manwol-ore-demo",
    regionId: "unhyang",
    title: "운봉석을 벼리는 법",
    description:
      "운봉석은 제대로 다룰 줄 아는 손이 드물어. 자네가 운봉석 여섯 덩이만 가져오면, 그걸로 시연을 보여줌세 — 거인 어깨 비늘로 견갑을 어떻게 짜는지. 보고 나면 자네 손에도 새겨질 거야.",
    requiredLevel: 22,
    target: { kind: "deliver", materialId: "unbong_ore", count: 6 },
    reward: { gold: 500, exp: 800, recipes: ["peak_mantle"], potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "unhyang_smith",
  },
  // ── 운향 — 사이드 의뢰 (도연 / 산하) ────────────────────────────────────
  {
    id: "unhyang-doyeon-wolves",
    regionId: "unhyang",
    title: "협곡의 무리",
    description:
      "협곡의 절벽 늑대가 너무 늘었어. 10마리만 정리해 주면 산이 좀 조용해질 거야. — 무리장 늑대를 잡으면 가끔 굵은 송곳니가 나오는데, 그걸로 단검 만드는 법도 알려줄게.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 10 },
    reward: { gold: 360, fame: 18, exp: 600, recipes: ["wolfking_fang_dagger"] },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
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
      "산기슭 바위 두꺼비, 그놈들 등껍데기가 길을 막아. 열다섯 마리만 치워 주면 짐꾼들 발이 좀 편해질 거야.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "바위 두꺼비", count: 15 },
    reward: { gold: 320, fame: 16, exp: 500 },
    repeatable: false,
    giverNpcId: "unhyang_guide",
  },
  {
    id: "unhyang-doyeon-windspirits",
    regionId: "unhyang",
    title: "협곡의 돌풍 정령",
    description:
      "협곡 돌풍 정령은 발 디딜 데를 못 잡게 만들어. 열둘만 흩어 주면 한동안 바람이 좀 잦을 거야.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "돌풍 정령", count: 12 },
    reward: { gold: 380, fame: 18, exp: 600 },
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
      "북쪽에서 온 순례자가 운저 평원을 지나 다시 떠난다네. 거기 떠돌이 약탈자 무리가 자리를 잡았다더군 — 열다섯만 손봐 주겠나? 순례자가 무사히 지나가게.",
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
      "디올라 여관 주인 노라한테 산정 약초를 좀 보내고 싶어요. 산초꽃 열 송이만 모아다 주시면 제가 부쳐 드릴게요 — 답례는 노라가 직접 챙겨 줄 거예요. 디올라 들르면 인사 한번 하시고요.",
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
      "시작 마을 나무꾼 지미가 산정 협곡의 목재 이야기를 하더라고. 그건 절벽 늑대 소굴 안쪽에 있어 — 열다섯 마리만 정리하면 안전하게 베어 와서 지미한테 부쳐 줄게.",
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
    title: "산기슭 — 산양 정리",
    description: "산기슭 비탈에 산양 떼가 다시 늘었습니다. 45마리를 정리해 주세요.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "산양", count: 45 },
    reward: { gold: 320, fame: 14, exp: 650 },
    repeatable: true,
  },
  {
    id: "unhyang-board-goats-large",
    regionId: "unhyang",
    title: "산기슭 — 산양 대규모 정리",
    description: "산양 떼가 비탈 전체를 뒤덮었습니다. 80마리를 정리해 주세요.",
    requiredLevel: 19,
    target: { kind: "kill", monsterName: "산양", count: 80 },
    reward: { gold: 620, fame: 24, exp: 1250 },
    repeatable: true,
  },
  {
    id: "unhyang-board-stone-frogs",
    regionId: "unhyang",
    title: "산기슭 — 바위 두꺼비 구제",
    description: "산기슭 길목을 바위 두꺼비가 메우고 있습니다. 40마리를 구제해 주세요.",
    requiredLevel: 18,
    target: { kind: "kill", monsterName: "바위 두꺼비", count: 40 },
    reward: { gold: 360, fame: 16, exp: 700 },
    repeatable: true,
  },
  {
    id: "unhyang-board-cliff-wolves",
    regionId: "unhyang",
    title: "협곡 — 절벽 늑대 사냥",
    description: "협곡 길에 절벽 늑대가 떼를 이뤘습니다. 40마리를 사냥해 주세요.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 40 },
    reward: { gold: 360, fame: 16, exp: 700 },
    repeatable: true,
  },
  {
    id: "unhyang-board-cliff-wolves-large",
    regionId: "unhyang",
    title: "협곡 — 절벽 늑대 대규모 사냥",
    description: "절벽 늑대가 협곡 전체를 장악했습니다. 75마리를 사냥해 주세요.",
    requiredLevel: 21,
    target: { kind: "kill", monsterName: "절벽 늑대", count: 75 },
    reward: { gold: 700, fame: 26, exp: 1300 },
    repeatable: true,
  },
  {
    id: "unhyang-board-windspirits",
    regionId: "unhyang",
    title: "협곡 — 돌풍 정령 진정",
    description: "협곡에 돌풍 정령이 몰려 길이 위태롭습니다. 35체를 진정시켜 주세요.",
    requiredLevel: 20,
    target: { kind: "kill", monsterName: "돌풍 정령", count: 35 },
    reward: { gold: 380, fame: 17, exp: 720 },
    repeatable: true,
  },
  {
    id: "unhyang-board-wolf-chieftain",
    regionId: "unhyang",
    title: "협곡 — 무리장 솎아내기",
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
    title: "운봉 — 대규모 무리장 토벌",
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
    title: "초원 매 깃털 열 장",
    description:
      "초원 매 깃털이 세공에 그만이거든. 10장만 모아다 주면 길에서 주운 좋은 걸 나눠 드리지. 깃털로 가벼운 망토를 짜는 법도 함께 알려 줌세.",
    requiredLevel: 28,
    target: { kind: "deliver", materialId: "hawk_feather", count: 10 },
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
  // 바람골 역참 길드 게시판 — 다리 구간 반복 의뢰.
  {
    id: "windvale-bison-cull",
    regionId: "windvale",
    title: "운저 평원 — 들소 정리",
    description:
      "운저 평원 들소가 다시 떼를 이뤘습니다. 40마리를 정리해 주세요.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "들소", count: 40 },
    reward: { gold: 400, fame: 16, exp: 700 },
    repeatable: true,
  },
  {
    id: "windvale-ash-hounds",
    regionId: "windvale",
    title: "잿빛 협로 — 들개 사냥",
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
      "잿빛 협로를 지나 봉황령을 넘으면 화산 지대가 나와요. 거기 깊은 곳에 — 사람들이 화산의 심장이라 부르는 게 깨어났습니다. 그놈을 잠재워야 그 너머 천공 성지로 가는 길이 열려요. 부탁 좀 드릴게요.",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "화산의 심장", count: 1 },
    reward: { gold: 2500, fame: 60, exp: 4500 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },
  {
    id: "windvale-lava-slimes",
    regionId: "windvale",
    title: "화산 지대 — 용암 슬라임 정화",
    description:
      "봉황령 너머 화산 지대에 용암 슬라임이 들끓는다는 소식이 들어왔습니다. 45마리를 정화해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "용암 슬라임", count: 45 },
    reward: { gold: 900, fame: 24, exp: 1800 },
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
  // 운향 길드 게시판 — 봉황령 반복 의뢰.
  {
    id: "unhyang-phoenix-ridge-patrol",
    regionId: "unhyang",
    title: "봉황령 순찰 — 산악 기사",
    description:
      "봉황령을 거점으로 삼은 산악 기사들이 골치야. 30명을 정리하면 길목이 안전해질 거요.",
    requiredLevel: 40,
    target: { kind: "kill", monsterName: "산악 기사", count: 30 },
    reward: { gold: 650, fame: 22, exp: 1300 },
    repeatable: true,
  },
  // ── 천공 성지 — 메인 라인 "능선 너머의 봉인" (원로 해무) ─────────────────
  // 화산의 심장 처치(volcano_heart_defeated, 천공 성지 진입 조건) 후 만나는 라인.
  // 봉황 무구 갑옷·액세서리 확정 제작서 + 성지 "또 다른 봉인" 서사. HaemuDialogue.
  {
    id: "skyreach-haemu-lava-core",
    regionId: "skyreach",
    title: "봉인의 자물쇠",
    description:
      "이 성지에는 화산의 심장 말고도 잠재워 둔 것이 있소. 그 봉인이 아래에서 올라오는 열기에 무뎌졌소 — 용암 핵 여섯 개면 자물쇠를 다시 채울 수 있소. 가져다 주면, 봉황 무구를 벼리는 법도 자네 손에 새겨 주리다.",
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
      exp: 2200,
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
    reward: { gold: 1000, fame: 26, exp: 2000 },
    repeatable: true,
    requiresQuestCompleted: "windvale-volcano-boss",
  },

  // ════════════════════════════════════════════════════════════════════════
  // 다리 구간 / 봉황령 / 화산 — 사이드 의뢰 + 게시판 (§3.1 §3.3 §4 §5)
  // ════════════════════════════════════════════════════════════════════════

  // ── 바람골 역참 — NPC 전속 사이드 (마로 / 노을 / 한솔) ───────────────────
  {
    id: "windvale-keeper-bison-king",
    regionId: "windvale",
    title: "들소 떼 — 다시, 더 크게",
    description:
      "솎아냈더니 더 큰 떼가 내려오는구려. 마흔 마리만 더 정리해 주시오 — 이번엔 울타리가 버텨야 할 텐데.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "들소", count: 40 },
    reward: { gold: 700, fame: 26, exp: 1100 },
    repeatable: false,
    giverNpcId: "windvale_keeper",
    requiresQuestCompleted: "windvale-keeper-bison",
  },
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
      "잿돌이 세공 받침에 그만이거든. 여덟 덩이만 모아다 줘 — 잿빛 협로 골렘이 가끔 떨군다더라.",
    requiredLevel: 34,
    target: { kind: "deliver", materialId: "ash_stone", count: 8 },
    reward: { gold: 550, exp: 700 },
    repeatable: false,
    giverNpcId: "windvale_merchant",
  },
  {
    id: "windvale-pathfinder-salamander",
    regionId: "windvale",
    title: "잿빛 협로의 불씨",
    description:
      "잿빛 협로에 불씨 도롱뇽이 들끓어. 열다섯만 꺼 주면 잿가루 사이로 길이 보일 거야.",
    requiredLevel: 34,
    target: { kind: "kill", monsterName: "불씨 도롱뇽", count: 15 },
    reward: { gold: 600, fame: 22, exp: 900 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
  },
  {
    id: "windvale-pathfinder-ridge-scout",
    regionId: "windvale",
    title: "봉황령 첫 발 — 능선 정찰",
    description:
      "잿빛 협로를 넘으면 봉황령이야. 거기 불꽃 독수리가 능선을 빙빙 돌아 — 열둘만 떨어뜨려 주면 첫 발 디딜 데가 생겨.",
    requiredLevel: 38,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 12 },
    reward: { gold: 750, fame: 24, exp: 1100 },
    repeatable: false,
    giverNpcId: "windvale_pathfinder",
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },

  // ── 바람골 역참 길드 게시판 (다리 구간 — 운저 평원·잿빛 협로 + 봉황령·화산 입구) ──
  {
    id: "windvale-board-bison-large",
    regionId: "windvale",
    title: "운저 평원 — 들소 대규모 정리",
    description: "들소가 평원 전체를 뒤덮었습니다. 75마리를 정리해 주세요.",
    requiredLevel: 29,
    target: { kind: "kill", monsterName: "들소", count: 75 },
    reward: { gold: 760, fame: 26, exp: 1350 },
    repeatable: true,
  },
  {
    id: "windvale-board-hawks",
    regionId: "windvale",
    title: "운저 평원 — 초원 매 사냥",
    description: "초원 매가 평원 짐수레를 노립니다. 35마리를 사냥해 주세요.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "초원 매", count: 35 },
    reward: { gold: 380, fame: 14, exp: 650 },
    repeatable: true,
  },
  {
    id: "windvale-board-raiders",
    regionId: "windvale",
    title: "운저 평원 — 약탈자 소탕",
    description: "떠돌이 약탈자가 평원 길목에 자리 잡았습니다. 30명을 소탕해 주세요.",
    requiredLevel: 28,
    target: { kind: "kill", monsterName: "떠돌이 약탈자", count: 30 },
    reward: { gold: 420, fame: 16, exp: 700 },
    repeatable: true,
  },
  {
    id: "windvale-board-ash-golems",
    regionId: "windvale",
    title: "잿빛 협로 — 재먼지 골렘 정리",
    description: "잿빛 협로를 재먼지 골렘이 메우고 있습니다. 30체를 정리해 주세요.",
    requiredLevel: 34,
    target: { kind: "kill", monsterName: "재먼지 골렘", count: 30 },
    reward: { gold: 520, fame: 18, exp: 850 },
    repeatable: true,
  },
  {
    id: "windvale-board-ash-salamanders",
    regionId: "windvale",
    title: "잿빛 협로 — 불씨 도롱뇽 진화",
    description: "잿빛 협로에 불씨 도롱뇽이 들끓습니다. 35마리를 진화해 주세요.",
    requiredLevel: 34,
    target: { kind: "kill", monsterName: "불씨 도롱뇽", count: 35 },
    reward: { gold: 480, fame: 17, exp: 800 },
    repeatable: true,
  },
  {
    id: "windvale-board-ash-golems-large",
    regionId: "windvale",
    title: "잿빛 협로 — 재먼지 골렘 대규모 정리",
    description: "재먼지 골렘이 협로 전체를 막았습니다. 60체를 정리해 주세요.",
    requiredLevel: 35,
    target: { kind: "kill", monsterName: "재먼지 골렘", count: 60 },
    reward: { gold: 980, fame: 28, exp: 1600 },
    repeatable: true,
  },
  {
    id: "windvale-board-ridge-eagles",
    regionId: "windvale",
    title: "봉황령 입구 — 능선 길 확보",
    description: "봉황령 능선에 불꽃 독수리가 들끓습니다. 30마리를 떨어뜨려 길을 확보해 주세요.",
    requiredLevel: 38,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 30 },
    reward: { gold: 700, fame: 22, exp: 1300 },
    repeatable: true,
    requiresQuestCompleted: "windvale-pathfinder-golems",
  },
  {
    id: "windvale-board-volcano-toads",
    regionId: "windvale",
    title: "화산 입구 — 화산 두꺼비 구제",
    description: "화산 지대 어귀에 화산 두꺼비가 들끓습니다. 30마리를 구제해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "화산 두꺼비", count: 30 },
    reward: { gold: 850, fame: 22, exp: 1600 },
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
    title: "봉황령 — 불꽃 독수리 솎아내기",
    description:
      "봉황령 능선에 불꽃 독수리가 너무 늘었어. 15마리만 떨어뜨려 줘 — 순찰대가 좀 숨통이 트일 거야.",
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
  {
    id: "skyreach-phoenix-ridge-eagles",
    regionId: "skyreach",
    title: "봉황령 순찰 — 불꽃 독수리",
    description: "봉황령 능선의 불꽃 독수리가 다시 떼를 이뤘습니다. 35마리를 순찰 중 정리해 주세요.",
    requiredLevel: 40,
    target: { kind: "kill", monsterName: "불꽃 독수리", count: 35 },
    reward: { gold: 700, fame: 22, exp: 1300 },
    repeatable: true,
  },
  {
    id: "skyreach-phoenix-ridge-lizards",
    regionId: "skyreach",
    title: "봉황령 순찰 — 화염 도마뱀",
    description: "봉황령 바위틈 화염 도마뱀이 길을 막습니다. 35마리를 정리해 주세요.",
    requiredLevel: 40,
    target: { kind: "kill", monsterName: "화염 도마뱀", count: 35 },
    reward: { gold: 680, fame: 21, exp: 1250 },
    repeatable: true,
  },
  {
    id: "skyreach-knight-captain-hunt",
    regionId: "skyreach",
    title: "봉황령 — 산악 기사 대규모 토벌",
    description: "봉황령에 산악 기사단이 진을 쳤습니다. 35명을 토벌해 순례길을 열어 주세요.",
    requiredLevel: 42,
    target: { kind: "kill", monsterName: "산악 기사", count: 35 },
    reward: { gold: 750, fame: 24, exp: 1400 },
    repeatable: true,
  },

  // ── 화산 지대 — 사이드 의뢰 (천공 검/시온 출처) ─────────────────────────
  {
    id: "skyreach-guide-volcano-toads",
    regionId: "skyreach",
    title: "화산 지대 — 화산 두꺼비",
    description:
      "화산 지대 용암 웅덩이 가에 화산 두꺼비가 들끓어. 15마리만 정리해 줘.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "화산 두꺼비", count: 15 },
    reward: { gold: 900, fame: 26, exp: 1500 },
    repeatable: false,
    giverNpcId: "skyreach_guide",
  },
  {
    id: "skyreach-guide-flame-golems",
    regionId: "skyreach",
    title: "화산 지대 — 불꽃 골렘",
    description:
      "화산 지대 깊은 곳에 불꽃 골렘이 어슬렁거려. 12체만 부숴 줘 — 광물째 녹아내리는 놈들이니 조심하고.",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "불꽃 골렘", count: 12 },
    reward: { gold: 1000, fame: 28, exp: 1700 },
    repeatable: false,
    giverNpcId: "skyreach_guide",
  },
  {
    id: "skyreach-alchemist-flame-scale",
    regionId: "skyreach",
    title: "화염 비늘 여덟 (연금)",
    description:
      "비늘에서 내열제를 추출해야 해. 봉황령 화염 도마뱀의 비늘 여덟 장만 모아다 줘.",
    requiredLevel: 52,
    target: { kind: "deliver", materialId: "flame_scale", count: 8 },
    reward: { gold: 1100, exp: 2000, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "skyreach_alchemist",
  },
  {
    id: "skyreach-volcanic-toads",
    regionId: "skyreach",
    title: "화산 지대 순찰 — 화산 두꺼비",
    description: "화산 지대 웅덩이 가에 화산 두꺼비가 다시 들끓습니다. 30마리를 정리해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "화산 두꺼비", count: 30 },
    reward: { gold: 850, fame: 22, exp: 1600 },
    repeatable: true,
  },
  {
    id: "skyreach-lava-slimes-2",
    regionId: "skyreach",
    title: "화산 지대 순찰 — 용암 슬라임",
    description: "화산 지대에 용암 슬라임이 들끓습니다. 40마리를 정화해 주세요.",
    requiredLevel: 52,
    target: { kind: "kill", monsterName: "용암 슬라임", count: 40 },
    reward: { gold: 800, fame: 20, exp: 1500 },
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
      "그놈을 열 번이나 잠재우면 동굴 안쪽이 한동안 조용하다고들 하더라고. 나야 무서워서 못 가지만 — 모험가 양반이라면 기록 한번 채워볼 만하지 않겠어?",
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
  {
    id: "volcano-heart-hunter",
    regionId: "skyreach",
    title: "화산의 심장 ─ 사냥 기록",
    description:
      "그것을 열 번이나 잠재운 자가 있었다는 옛 기록이 성지에 남아 있어. 솜씨가 있다면 — 자네가 그 기록을 다시 써 보겠어?",
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
      "화산의 심장을 잠재울 때마다 떨어지는 것들 — 용암 핵. 그걸로 봉인 보강제를 만들어 봐야겠어. 열 개만 모아다 줘.",
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
  },
  {
    id: "hidden-deepest-vein",
    regionId: "village",
    title: "광맥의 끝",
    description:
      "광맥의 수호자를 그렇게 여러 번 잠재웠으면, 동굴 안쪽 더 깊은 데서 마정석이 진하게 고였을 거다. 스무 덩이만 가져와 봐 — 광맥의 끝이 어디까지 뻗었는지, 그걸로 가늠해 보자.",
    requiredLevel: 6,
    target: { kind: "deliver", materialId: "mana_crystal", count: 20 },
    reward: { gold: 1200, exp: 1800, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "village_blacksmith_bold",
    requiresQuestCompleted: "deep-cave-hunter",
  },
  {
    id: "hidden-blacksmith-duel",
    regionId: "village",
    title: "마저 두드린 것",
    description:
      "옛날에 만월이랑 무기 하나를 절반씩 만들다 싸우고 헤어졌지. 둘 다 다시 만났으니… 마저 완성해 볼까 싶어. 단단한 결정 여덟 덩이만 가져와 봐.",
    requiredLevel: 22,
    target: { kind: "deliver", materialId: "hard_crystal", count: 8 },
    reward: { gold: 1500, exp: 2500, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "village_blacksmith_bold",
  },
  {
    id: "hidden-giants-origin",
    regionId: "unhyang",
    title: "거인은 어디서 왔나",
    description:
      "거인이 어디서 왔는지 알고 싶나? …협곡 가장 깊은 곳, 돌풍 정령이 모이는 자리를 봐라. 예순쯤 흩어 놓으면 그 자리가 드러난다. 그 다음은 — 내가 본 것을 말해주지.",
    requiredLevel: 22,
    target: { kind: "kill", monsterName: "돌풍 정령", count: 60 },
    reward: { gold: 1200, fame: 20, exp: 2000 },
    repeatable: false,
    giverNpcId: "unhyang_pilgrim",
    requiresQuestCompleted: "unhyang-baekun-peak-giant",
  },
  {
    id: "hidden-volcano-relic",
    regionId: "skyreach",
    title: "심장이 잠든 자리",
    description:
      "심장이 잠든 자리에 정수가 고였더군 — 화산 두꺼비를 충분히 잡으면 그 정수가 흘러나올 거야. 마흔 마리쯤이면 돼. 그걸로 뭔가 만들어 볼 수 있겠어.",
    requiredLevel: 55,
    target: { kind: "kill", monsterName: "화산 두꺼비", count: 40 },
    reward: { gold: 1500, exp: 2500, potionCapacityBonus: 1 },
    repeatable: false,
    giverNpcId: "skyreach_alchemist",
    requiresQuestCompleted: "windvale-volcano-boss",
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
