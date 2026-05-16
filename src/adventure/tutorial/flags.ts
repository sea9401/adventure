// 튜토리얼 플래그는 storyFlags 시스템 위에 prefix 컨벤션으로 얹는다.
// 별도 스토리지를 두지 않는 이유: 신규/기존 캐릭터 분리(starterSaves 시드)와
// "다시 보기" 시 일괄 reset 만 prefix 필터로 처리하면 충분하기 때문.

export const TUTORIAL_FLAG_PREFIX = "tutorial.";

// 신규 캐릭터는 starterSaves 가 시드. 기존 캐릭터는 미설정이라 자동 트리거되지 않는다.
export const TUTORIAL_ENABLED_FLAG = "tutorial.enabled";

export type TutorialStepId = `tutorial.${string}`;
