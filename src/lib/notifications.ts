export type NotificationKind =
  | "battle_win"
  | "battle_lose"
  | "training_done"
  | "quest_ready"
  | "quest_complete"
  | "info";

// 알림 종류별로 부착될 수 있는 부가 데이터. UI에서 expand 시 사용.
// kind = "battle_win" | "battle_lose" 일 때 battleLog가 있으면 RecentLogView에서 클릭 시 전투 로그 펼쳐 보기.
// highlight 가 있으면 토스트/알림 패널에서 메시지 안의 name 부분만 className 으로 강조한다.
//   — lib 레이어가 adventure 도메인(ItemId, rarity)을 모르도록 색상 className 자체를 직접 담는다.
export type NotificationMeta = {
  battleLog?: { kind: string; text: string }[];
  highlight?: { name: string; className: string };
};

export type AppNotification = {
  id: string;
  timestamp: number;
  kind: NotificationKind;
  text: string;
  meta?: NotificationMeta;
};

export const NOTIFICATIONS_STORAGE_KEY = "notifications.v2";
export const MAX_NOTIFICATIONS_PER_GROUP = 10;

const BATTLE_KINDS: ReadonlySet<NotificationKind> = new Set([
  "battle_win",
  "battle_lose",
]);

export function isBattleNotification(kind: NotificationKind): boolean {
  return BATTLE_KINDS.has(kind);
}

// 전투 / 시스템 두 그룹으로 나눠 각 그룹을 MAX_NOTIFICATIONS_PER_GROUP 개로 제한.
// 입력 list 는 newest-first 가정 — 그룹 카운터를 채우면서 순서는 그대로 유지.
export function pruneNotifications(
  list: AppNotification[],
): AppNotification[] {
  let battle = 0;
  let system = 0;
  return list.filter((n) => {
    if (isBattleNotification(n.kind)) {
      if (battle >= MAX_NOTIFICATIONS_PER_GROUP) return false;
      battle++;
      return true;
    }
    if (system >= MAX_NOTIFICATIONS_PER_GROUP) return false;
    system++;
    return true;
  });
}

export type NotificationStorage = {
  list: AppNotification[];
  lastReadAt: number;
};

const initial: NotificationStorage = { list: [], lastReadAt: 0 };

export function loadNotifications(): NotificationStorage {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<NotificationStorage>;
    return {
      list: Array.isArray(parsed.list) ? pruneNotifications(parsed.list) : [],
      lastReadAt: parsed.lastReadAt ?? 0,
    };
  } catch {
    return initial;
  }
}

export function saveNotifications(data: NotificationStorage): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function genNotificationId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  );
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return "방금 전";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}시간 전`;
  return `${Math.floor(diff / 86400_000)}일 전`;
}
