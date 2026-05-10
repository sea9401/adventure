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
  { id: "chatterbox", key: "chatCount", target: 100 },
  { id: "patient", key: "healingCount", target: 50 },
];

export function getTitle(id: TitleId | null | undefined): Title | undefined {
  if (!id) return undefined;
  return TITLES[id];
}
