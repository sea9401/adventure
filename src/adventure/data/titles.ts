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
    name: "새벽형 인간",
    description: "남들이 잘 때 모험을 떠나는 자.",
    condition: "새벽 3~5시 접속",
  },
  training_10: {
    id: "training_10",
    name: "수련생",
    description: "훈련의 첫 호흡을 익힌 자.",
    condition: "훈련 10회 완료",
  },
  training_50: {
    id: "training_50",
    name: "단련된 자",
    description: "땀으로 다져진 몸. 가벼운 한 걸음에도 무게가 실린다.",
    condition: "훈련 50회 완료",
  },
  training_100: {
    id: "training_100",
    name: "강철의 의지",
    description: "꺾일 줄 모르는 의지. 훈련장의 전설로 불린다.",
    condition: "훈련 100회 완료",
  },
  unfilial: {
    id: "unfilial",
    name: "불효자",
    description: "어머니가 손수 챙겨 준 부적을 두 푼 돈에 넘긴 자.",
    condition: "엄마가 준 부적을 상점에 판매",
  },
};

// 훈련 완료 횟수 → 잠금 해제되는 칭호. completedCount 가 임계값 도달 시 적용.
export const TRAINING_COUNT_TITLES: { count: number; id: TitleId }[] = [
  { count: 10, id: "training_10" },
  { count: 50, id: "training_50" },
  { count: 100, id: "training_100" },
];

export function getTitle(id: TitleId | null | undefined): Title | undefined {
  if (!id) return undefined;
  return TITLES[id];
}
