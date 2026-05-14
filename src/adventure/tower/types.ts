// 고탑(엔드컨텐츠 PR-1) 데이터 모델 — 클라/서버 양쪽이 import.
//
// 저장 모델 (savesKv 키 "tower.v1"): { progress, run, daily }
//   progress — 영구 기록 (최고층, 수령한 마일스톤)
//   run      — 현재 진행 중인 시도 (없으면 null)
//   daily    — 일일 시도 카운트 (자정 KST 리셋)
//
// 한 시도(run) = 사망하거나 포기할 때까지의 연속 전투 묶음.
// 한 층(floor) = 한 전투. 보스층(10/20/...) 클리어 시 체크포인트 갱신.

export type TowerProgress = {
  /** 영구 최고층. 0 = 아직 1층도 클리어 못 함. */
  highestFloor: number;
  /** 첫 도달 마일스톤 보상을 이미 수령한 층들. */
  claimedMilestones: number[];
};

export type TowerRun = {
  /** 다음 전투할 층. 시작 시 = (체크포인트 + 1), 매 승리 후 +1. */
  currentFloor: number;
  /** 진행 중 시도 시작 시각 (epoch ms). 진단/통계용. */
  startedAt: number;
};

export type TowerDaily = {
  /** "YYYY-MM-DD" (sv-SE = ISO 형식, 클라이언트 로컬 자정 기준). */
  date: string;
  /** 시작한 시도 수. 일일 캡(TOWER_DAILY_ATTEMPTS)에서 검증. */
  attempts: number;
};

export type TowerState = {
  progress: TowerProgress;
  run: TowerRun | null;
  daily: TowerDaily | null;
};

export const TOWER_STORAGE_KEY = "tower.v1";

/** 일일 도전 시도 가능 횟수. */
export const TOWER_DAILY_ATTEMPTS = 3;

/** 보스가 등장하는 층 주기. */
export const TOWER_BOSS_INTERVAL = 10;

/** 한 mob 풀이 적용되는 층 개수 (5층마다 풀 전환). */
export const TOWER_POOL_BLOCK_SIZE = 5;

/** 현재 Phase 1 에서 보스 슬롯이 정의된 최대 층. 130 초과 진입 시 마지막 슬롯 재사용. */
export const TOWER_MAX_DEFINED_FLOOR = 130;
