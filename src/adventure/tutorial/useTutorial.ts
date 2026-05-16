"use client";

import { useCallback } from "react";
import { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { TUTORIAL_ENABLED_FLAG, type TutorialStepId } from "./flags";

export type TutorialState = {
  shown: boolean;
  dismiss: () => void;
};

// 전체 유저 튜토리얼 OFF kill-switch.
// 다시 켜려면 false 로 바꾸면 됨 — 데이터/플래그는 그대로 보존되어 있어
// 토글만 풀면 기존 진행도에서 그대로 재개됨.
const TUTORIAL_KILL_SWITCH = true;

export function useTutorial(stepId: TutorialStepId): TutorialState {
  const { has, set } = useStoryFlags();
  const enabled = has(TUTORIAL_ENABLED_FLAG);
  const seen = has(stepId);
  const shown = !TUTORIAL_KILL_SWITCH && enabled && !seen;
  const dismiss = useCallback(() => set(stepId), [set, stepId]);
  return { shown, dismiss };
}
