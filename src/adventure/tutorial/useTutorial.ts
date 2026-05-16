"use client";

import { useCallback } from "react";
import { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { TUTORIAL_ENABLED_FLAG, type TutorialStepId } from "./flags";

export type TutorialState = {
  shown: boolean;
  dismiss: () => void;
};

export function useTutorial(stepId: TutorialStepId): TutorialState {
  const { has, set } = useStoryFlags();
  const enabled = has(TUTORIAL_ENABLED_FLAG);
  const seen = has(stepId);
  const shown = enabled && !seen;
  const dismiss = useCallback(() => set(stepId), [set, stepId]);
  return { shown, dismiss };
}
