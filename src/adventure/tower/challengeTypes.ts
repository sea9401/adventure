// 고탑 도전 모드 — Phase 3-2 의 데이터 모델. 일반 탑(tower.v1) 과 별도 키, 별도 진행.
//
// 저장 모델 (savesKv 키 "tower-challenge.v1"): { progress, run, daily }
//   progress — 영구 최고층 (도전 모드 한정). 일반 탑 progress 와 무관.
//   run      — 현재 진행 중인 도전 시도 (없으면 null).
//   daily    — 일일 시도 카운트 (자정 KST 리셋).
//
// 일반 탑과의 차이 (PR-A 합의 사양):
//   - 1.5× HP/ATK/DEF (SPD 제외) — scaledStats 에 CHALLENGE_MODIFIER 로 주입.
//   - 체크포인트 없음 — 매번 F1 부터. startFloor 옵션 없음.
//   - 주간 모디파이어 적용 X.
//   - 룬/토큰 드롭 X. 보스 클리어해도 인벤 갱신 없음.
//   - F50 보스 클리어 시 단일 칭호 (tower_challenge_f50) 부여.
//   - 자동 진행 미지원 — 매 층 수동.

export type TowerChallengeProgress = {
  /** 도전 모드 영구 최고층. 0 = 아직 1층도 클리어 못 함. */
  highestFloor: number;
};

export type TowerChallengeRun = {
  /** 다음 전투할 층. 시작 시 항상 1, 매 승리 후 +1. */
  currentFloor: number;
  /** 진행 중 시도 시작 시각 (epoch ms). 진단/통계용. */
  startedAt: number;
  /**
   * 잡몹층 한정 — 다음 전투할 적의 MONSTERS 키. 일반 탑 패턴과 동일하게 ready 화면용.
   * 보스층은 결정적이라 미저장. 미존재 시 fight 시점에 즉시 픽 (한 번의 mismatch 후 일치).
   */
  upcomingEnemy?: { name: string };
};

export type TowerChallengeDaily = {
  /** "YYYY-MM-DD" (KST). */
  date: string;
  /** 시작한 시도 수. 일일 캡(TOWER_CHALLENGE_DAILY_ATTEMPTS) 에서 검증. */
  attempts: number;
};

export type TowerChallengeState = {
  progress: TowerChallengeProgress;
  run: TowerChallengeRun | null;
  daily: TowerChallengeDaily | null;
};

export const TOWER_CHALLENGE_STORAGE_KEY = "tower-challenge.v1";

/** 일일 도전 시도 가능 횟수 (일반 탑과 별도 카운터). */
export const TOWER_CHALLENGE_DAILY_ATTEMPTS = 3;

/** F50 도달 시 부여되는 단일 칭호 id. */
export const TOWER_CHALLENGE_TITLE_ID = "tower_challenge_f50";

/** 칭호 부여 임계층 — F50 보스 클리어 시점. */
export const TOWER_CHALLENGE_TITLE_FLOOR = 50;
