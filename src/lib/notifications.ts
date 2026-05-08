export type NotificationKind =
  | "battle_win"
  | "battle_lose"
  | "training_done"
  | "quest_ready"
  | "quest_complete"
  | "info";

// 알림 종류별로 부착될 수 있는 부가 데이터. UI에서 expand 시 사용.
// kind = "battle_win" | "battle_lose" 일 때 battleLog가 있으면 RecentLogView에서 클릭 시 전투 로그 펼쳐 보기.
export type NotificationMeta = {
  battleLog?: { kind: string; text: string }[];
};

export type AppNotification = {
  id: string;
  timestamp: number;
  kind: NotificationKind;
  text: string;
  meta?: NotificationMeta;
};

export const NOTIFICATIONS_STORAGE_KEY = "notifications.v2";
export const MAX_NOTIFICATIONS = 10;

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
      list: Array.isArray(parsed.list)
        ? parsed.list.slice(0, MAX_NOTIFICATIONS)
        : [],
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
