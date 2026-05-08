// 서버 동기화 대상 키 화이트리스트.
// 디바이스별 설정(theme, auto-potion-rules, battle-settings, notifications)은
// 일부러 제외 — 디바이스마다 다를 수 있는 항목.
export const SYNCED_KEYS = [
  "character-profile.v2",
  "character.v2",
  "training.v2",
  "inventory.v2",
  "crafting.v2",
  "quest-progress.v2",
  "adventure-log.v2",
  "map.v2",
  "edge-unlocks.v2",
  "storyFlags.v2",
] as const;

export type SyncedKey = (typeof SYNCED_KEYS)[number];

export function isSyncedKey(key: string): key is SyncedKey {
  return (SYNCED_KEYS as readonly string[]).includes(key);
}
