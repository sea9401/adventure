export type NotificationKind =
  | "battle_win"
  | "battle_lose"
  | "training_done"
  | "quest_ready"
  | "info";

export type AppNotification = {
  id: string;
  timestamp: number;
  kind: NotificationKind;
  text: string;
};

export const NOTIFICATIONS_STORAGE_KEY = "notifications.v1";
export const MAX_NOTIFICATIONS = 20;

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
