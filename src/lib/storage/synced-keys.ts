// 서버 동기화 대상 키 화이트리스트.
// 디바이스별 설정(theme, auto-potion-rules, battle-settings, notifications)은
// 일부러 제외 — 디바이스마다 다를 수 있는 항목.
//
// ⚠️ 새 키를 이 배열에 추가할 때는 SaveProvider 의 MIGRATION_MARKER_KEY
//    ("migrated.v2") 도 함께 버전을 올려야(예: "migrated.v3") 기존 유저의
//    localStorage 값이 한 번 더 서버로 push 된다. 마커가 이미 박힌 디바이스는
//    마이그레이션 블록을 건너뛰어 새 키가 영영 동기화되지 않는다.
export const SYNCED_KEYS = [
  "character-profile.v2",
  "character.v2",
  "training.v2",
  "inventory.v2",
  "crafting.v2",
  "quest-progress.v2",
  "adventure-log.v2",
  "map.v2",
  "trial-unlocks.v1",
  "storyFlags.v2",
  "shop.unlocks.v1",
  "trial.v1",
] as const;

export type SyncedKey = (typeof SYNCED_KEYS)[number];

export function isSyncedKey(key: string): key is SyncedKey {
  return (SYNCED_KEYS as readonly string[]).includes(key);
}
