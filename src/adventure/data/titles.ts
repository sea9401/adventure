// 칭호 정의. 새 칭호 추가 시:
// 1) TITLES 에 항목 추가 (id, name, description, condition)
// 2) 조건이 만족되는 시점에 adventureLog.markTitleObtained(id) 호출
//    (예: 보스 처치 직후, 퀘스트 완료 후, 레벨업 콜백 등)
// 3) docs/items.md 같은 도감 표가 있으면 함께 갱신

export type TitleId = string;

export type Title = {
  id: TitleId;
  name: string;
  description: string;
  /** 사용자가 도감에서 보게 될 획득 조건 설명. */
  condition: string;
};

export const TITLES: Record<TitleId, Title> = {
  first_blood: {
    id: "first_blood",
    name: "초보 사냥꾼",
    description: "처음으로 몬스터를 쓰러뜨린 자.",
    condition: "몬스터 1마리 처치",
  },
  frail: {
    id: "frail",
    name: "약골",
    description: "수 차례 쓰러져도 다시 일어선 자. 자랑은 아니다.",
    condition: "전투 패배 10회",
  },
  chatterbox: {
    id: "chatterbox",
    name: "수다쟁이",
    description: "광장에 말을 자주 얹는 자.",
    condition: "글로벌 채팅 100회 발화",
  },
  patient: {
    id: "patient",
    name: "환자",
    description: "치료소 단골. 의사와 안면을 텄다.",
    condition: "치료소 50회 이용",
  },
  early_bird: {
    id: "early_bird",
    name: "새벽반",
    description: "남들이 잘 때 모험을 떠나는 자.",
    condition: "새벽 3~5시 접속",
  },
  training_10: {
    id: "training_10",
    name: "수련생",
    description: "훈련의 첫 호흡을 익힌 자.",
    condition: "훈련 50회 완료",
  },
  training_50: {
    id: "training_50",
    name: "유단자",
    description: "땀으로 다져진 몸. 가벼운 한 걸음에도 무게가 실린다.",
    condition: "훈련 100회 완료",
  },
  training_100: {
    id: "training_100",
    name: "검은띠",
    description: "꺾일 줄 모르는 의지. 훈련장의 전설로 불린다.",
    condition: "훈련 200회 완료",
  },
  merchant: {
    id: "merchant",
    name: "상인",
    description: "상점에 같은 물건을 잔뜩 넘겨 단골이 된 자.",
    condition: "한 종류의 재료를 상점에 100개 이상 판매",
  },
  unfilial: {
    id: "unfilial",
    name: "불효자",
    description: "어머니가 손수 챙겨 준 부적을 두 푼 돈에 넘긴 자.",
    condition: "엄마가 준 부적을 상점에 판매",
  },
  diola_friend: {
    id: "diola_friend",
    name: "디올라의 친구",
    description: "안개 호숫가의 작은 어촌이 그를 식구처럼 받아들였다.",
    condition: "촌장 마린의 의뢰까지 모두 완수",
  },
  mountain_friend: {
    id: "mountain_friend",
    name: "산정의 벗",
    description: "잠들지 않던 것을 잠재우고, 구름 위 마을의 숨을 되돌린 자.",
    condition: "운향 — 노촌장 백운의 '운봉의 거인' 의뢰 완수",
  },
  ridge_crosser: {
    id: "ridge_crosser",
    name: "능선을 넘은 자",
    description: "화염 능선을 넘어 천공 성지의 마지막 봉인을 다시 채운 자.",
    condition: "천공 성지 — 원로 해무의 봉인 라인('마지막 자물쇠') 완수",
  },
  herbalists_courier: {
    id: "herbalists_courier",
    name: "약초꾼의 전령",
    description: "산정의 약초를 안개 호숫가까지 실어 나른 자. 두 약초꾼이 그를 기억한다.",
    condition: "운향 약초꾼 산하의 '디올라로 보내는 약초' 완수",
  },
  beggar: {
    id: "beggar",
    name: "거지",
    description: "한 푼 없는 신세를 한 번이라도 겪은 자.",
    condition: "보유 골드 0 도달",
  },
  phisher: {
    id: "phisher",
    name: "보이스피싱범",
    description: "한 사람을 붙들고 백 번을 캐물은 자. 의심받기 충분하다.",
    condition: "동일 NPC 와 100회 대화",
  },
  guild_founder: {
    id: "guild_founder",
    name: "창립자",
    description: "직접 깃발을 세워 길드를 연 자.",
    condition: "길드 창설",
  },
  guild_member: {
    id: "guild_member",
    name: "사원",
    description: "어느 깃발 아래 처음 이름을 올린 자.",
    condition: "길드 가입",
  },
  unknown_soldier: {
    id: "unknown_soldier",
    name: "무명소졸",
    description: "이름 없는 자리에서 거듭 쓰러져도 또 일어선 자.",
    condition: "전투 패배 100회",
  },
  one_track: {
    id: "one_track",
    name: "외골수",
    description: "한 길에만 모든 것을 쏟아부은 자. 다른 길은 보이지 않았다.",
    condition: "한 스탯 30 이상, 나머지 모두 10 이하",
  },
  giant_slayer: {
    id: "giant_slayer",
    name: "거인살해자",
    description: "운봉의 거인을 홀로 절반 이상 깎아낸 자. 산정의 메아리가 그를 기억한다.",
    condition: "운봉의 거인 협동 처치에서 누적 데미지 50% 이상 (legend 티어)",
  },
  level_30: {
    id: "level_30",
    name: "베테랑",
    description: "수많은 전장에서 살아남은 자. 한 발 한 발이 가볍지 않다.",
    condition: "레벨 30 도달",
  },
  level_50: {
    id: "level_50",
    name: "전설",
    description: "묘비에도 이름이 새겨질 자. 전장마다 흔적이 남는다.",
    condition: "레벨 50 도달",
  },
  level_70: {
    id: "level_70",
    name: "신화",
    description: "이야기가 전설이 되고, 전설이 신화가 된 자.",
    condition: "레벨 70 도달 (만렙)",
  },
  wealthy: {
    id: "wealthy",
    name: "부자",
    description: "지갑이 두툼해진 자. 호주머니의 무게가 발걸음을 늦춘다.",
    condition: "보유 골드 10,000 도달",
  },
  closed_shop: {
    id: "closed_shop",
    name: "폐업점주",
    description: "직접 세운 깃발을 직접 내린 자. 정리는 시작보다 어렵다.",
    condition: "본인이 마스터인 길드 해체",
  },
  stagnant: {
    id: "stagnant",
    name: "고인물",
    description: "맨몸으로도 보스 앞에 선 자. 장비 따위는 거추장스러워졌다.",
    condition: "장비 미착용 상태로 보스 도전",
  },
  loudspeaker: {
    id: "loudspeaker",
    name: "확성기",
    description: "광장에 천 마디를 얹은 자. 이제 그의 목소리를 모르는 사람이 없다.",
    condition: "글로벌 채팅 1,000회 발화",
  },
  gym_rat: {
    id: "gym_rat",
    name: "헬창",
    description: "근육이 곧 인격이라 믿는 자. '쉰다'는 단어를 어디에 뒀는지 잊었다.",
    condition: "훈련 500회 완료",
  },
  sandbag: {
    id: "sandbag",
    name: "샌드백",
    description: "수십 번 두들겨 맞고도 또 일어선다. 단단해진 건지 무뎌진 건지.",
    condition: "전투 패배 50회",
  },
  vip_patient: {
    id: "vip_patient",
    name: "VIP 환자",
    description: "치료소 회전문이 그의 출입 리듬에 맞춰 돈다. 의사가 전용 이름표를 만들어 줬다.",
    condition: "치료소 200회 이용",
  },
  nouveau_riche: {
    id: "nouveau_riche",
    name: "졸부",
    description: "지갑이 터질 듯하다. 굳이 티는 내지 말자… 라기엔 이미 티가 난다.",
    condition: "보유 골드 1,000,000 도달",
  },
  well_rounded: {
    id: "well_rounded",
    name: "골고루",
    description: "이것저것 다 조금씩 찍은 자. 모난 데 없는 게 장점이라면 장점이다.",
    condition: "모든 스탯 15 이상이면서 최댓값과 최솟값 차이 4 이하",
  },
  landlord: {
    id: "landlord",
    name: "건물주",
    description: "골드 십만. 동네 가게 한 칸쯤은 살 수 있겠다고 진지하게 계산해 봤다.",
    condition: "보유 골드 100,000 도달",
  },
  devoted_listener: {
    id: "devoted_listener",
    name: "전속 청취자",
    description: "같은 사람을 오백 번 붙들었다. 이젠 그쪽이 먼저 안부를 묻는다.",
    condition: "동일 NPC 와 500회 대화",
  },
  marathoner: {
    id: "marathoner",
    name: "마라토너",
    description: "천 번을 훈련한 자. 운동이 일상을 지나 인생이 됐다.",
    condition: "훈련 1,000회 완료",
  },
  town_broadcaster: {
    id: "town_broadcaster",
    name: "마을 방송국",
    description: "광장 채팅창이 곧 그의 일기장. 마을 사람 모두가 그의 근황을 안다.",
    condition: "글로벌 채팅 3,000회 발화",
  },
  head_patient: {
    id: "head_patient",
    name: "수석 환자",
    description: "치료소가 명예의 전당 헌액을 진지하게 검토 중이다.",
    condition: "치료소 500회 이용",
  },
  close_call: {
    id: "close_call",
    name: "구사일생",
    description: "체력 한 칸을 부여잡고 살아남은 자. 이건 어디 가서 자랑해도 된다.",
    condition: "체력 1 남긴 채로 전투 승리",
  },
  potion_overload: {
    id: "potion_overload",
    name: "포션 폭격기",
    description: "한 전투에서 포션을 다섯 병이나 들이부은 자. 회복 효율보단 손맛이다.",
    condition: "한 전투에서 포션 5병 이상 사용",
  },
  night_owl: {
    id: "night_owl",
    name: "야행성",
    description: "남들 다 잘 때 칼을 휘두르는 자. 해는 적이다.",
    condition: "자정~새벽 3시 사이 접속",
  },
  globetrotter: {
    id: "globetrotter",
    name: "방방곡곡",
    description: "세상 끝에서 끝까지 발자국을 남긴 자. 발바닥에 굳은살이 박였다.",
    condition: "모든 지역 방문",
  },
  masterwork: {
    id: "masterwork",
    name: "명장",
    description: "망치질에 신이 깃든 자. 손끝에서 걸작이 나왔다.",
    condition: "제작으로 '걸작' 등급 장비 획득",
  },
  botched: {
    id: "botched",
    name: "불량품 제작자",
    description: "최선을 다했는데 불량품이 나왔다. 누구에게나 그런 날이 있다.",
    condition: "제작으로 '불량' 등급 장비 획득",
  },
  one_coin: {
    id: "one_coin",
    name: "동전 한 닢",
    description: "마지막 동전 한 닢을 쥔 자. 거지보단 조금 낫다고 우긴다.",
    condition: "보유 골드 정확히 1",
  },
  young_rich: {
    id: "young_rich",
    name: "어린 부자",
    description: "레벨은 낮은데 지갑만 두툼하다. 운이 좋았거나, 안 자고 했거나.",
    condition: "레벨 10 미만 + 보유 골드 100,000 도달",
  },
};

// 카운터 기반 칭호 — 진행도 source 와 임계값을 한 곳에 정리.
// 1) 임계값 도달 시 자동 등록 (page.tsx 의 useEffect 가 이 표를 돌면서 grantTitle).
// 2) 절반 도달 시 모험의 서에서 조건만 미리 공개 (이름은 여전히 ???).
export type TitleCounterKey =
  | "battleLosses"
  | "trainingCount"
  | "chatCount"
  | "healingCount";

export const COUNTER_TITLES: {
  id: TitleId;
  key: TitleCounterKey;
  target: number;
}[] = [
  { id: "frail", key: "battleLosses", target: 10 },
  { id: "unknown_soldier", key: "battleLosses", target: 100 },
  { id: "training_10", key: "trainingCount", target: 50 },
  { id: "training_50", key: "trainingCount", target: 100 },
  { id: "training_100", key: "trainingCount", target: 200 },
  { id: "sandbag", key: "battleLosses", target: 50 },
  { id: "gym_rat", key: "trainingCount", target: 500 },
  { id: "marathoner", key: "trainingCount", target: 1000 },
  { id: "chatterbox", key: "chatCount", target: 100 },
  { id: "loudspeaker", key: "chatCount", target: 1000 },
  { id: "town_broadcaster", key: "chatCount", target: 3000 },
  { id: "patient", key: "healingCount", target: 50 },
  { id: "vip_patient", key: "healingCount", target: 200 },
  { id: "head_patient", key: "healingCount", target: 500 },
];

export function getTitle(id: TitleId | null | undefined): Title | undefined {
  if (!id) return undefined;
  return TITLES[id];
}
