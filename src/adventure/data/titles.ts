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
};

export function getTitle(id: TitleId | null | undefined): Title | undefined {
  if (!id) return undefined;
  return TITLES[id];
}
