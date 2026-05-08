export type StoryFlagsState = {
  flags: string[];
};

export const STORY_FLAGS_STORAGE_KEY = "storyFlags.v2";

export const emptyStoryFlagsState = (): StoryFlagsState => ({ flags: [] });

export function readStoryFlagsState(raw: unknown): StoryFlagsState {
  if (!raw || typeof raw !== "object") return emptyStoryFlagsState();
  const parsed = raw as Partial<StoryFlagsState>;
  return {
    flags: Array.isArray(parsed.flags)
      ? parsed.flags.filter((f): f is string => typeof f === "string")
      : [],
  };
}
