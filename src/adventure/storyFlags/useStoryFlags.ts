"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import {
  STORY_FLAGS_STORAGE_KEY,
  readStoryFlagsState,
  type StoryFlagsState,
} from "./storage";

export function useStoryFlags() {
  const initial = useSavedValue(STORY_FLAGS_STORAGE_KEY);
  const [state, setState] = useState<StoryFlagsState>(() =>
    readStoryFlagsState(initial),
  );
  useRemotePatch(STORY_FLAGS_STORAGE_KEY, state);

  const has = useCallback(
    (id: string) => state.flags.includes(id),
    [state.flags],
  );

  const set = useCallback((id: string) => {
    setState((prev) =>
      prev.flags.includes(id) ? prev : { flags: [...prev.flags, id] },
    );
  }, []);

  return { state, has, set };
}
