// 캐릭터 아바타 id — 외형 6종 (남자 1~3 / 여자 1~3).
// "use client" 모듈에서 분리된 순수 데이터/타입 — 서버 라우트도 안전하게 import 가능.
// 이전 버전의 "male"/"female" 도 마이그레이션 시점에 male1/female1 로 흡수.
export const AVATARS = [
  "male1",
  "male2",
  "male3",
  "female1",
  "female2",
  "female3",
] as const;
export type Avatar = (typeof AVATARS)[number];

// 하위 호환용 — 기존 코드의 Gender 타입 자리. 새 코드에서는 Avatar 사용.
export type Gender = Avatar;
