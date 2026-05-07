import { useEffect, useState } from "react";
import {
  genNotificationId,
  loadNotifications,
  saveNotifications,
  MAX_NOTIFICATIONS,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";

export function useNotifications() {
  const [list, setList] = useState<AppNotification[]>([]);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadNotifications();
    // localStorage 는 클라이언트 마운트 후에만 접근 가능 — useEffect 1회 hydrate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(stored.list);
    setLastReadAt(stored.lastReadAt);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveNotifications({ list, lastReadAt });
  }, [hydrated, list, lastReadAt]);

  const add = (kind: NotificationKind, text: string) => {
    const notif: AppNotification = {
      id: genNotificationId(),
      timestamp: Date.now(),
      kind,
      text,
    };
    setList((prev) => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
  };

  const markRead = () => setLastReadAt(Date.now());

  const clear = () => {
    setList([]);
    setLastReadAt(Date.now());
  };

  // 알림(종·토스트)은 의미 있는 종류만 — battle_win·info는 최근 기록에만 남김.
  const alertable = list.filter(
    (n) => n.kind !== "battle_win" && n.kind !== "info",
  );
  const unreadCount = alertable.filter((n) => n.timestamp > lastReadAt).length;

  return { list, alertable, unreadCount, add, markRead, clear };
}
