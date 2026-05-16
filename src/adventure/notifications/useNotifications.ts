import { useEffect, useState } from "react";
import {
  genNotificationId,
  loadNotifications,
  pruneNotifications,
  saveNotifications,
  type AppNotification,
  type NotificationKind,
  type NotificationMeta,
} from "@/lib/notifications";
import { useToastPrefs } from "@/lib/notification-prefs";

export function useNotifications() {
  const [list, setList] = useState<AppNotification[]>([]);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);
  const { prefs } = useToastPrefs();

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

  const add = (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => {
    const notif: AppNotification = {
      id: genNotificationId(),
      timestamp: Date.now(),
      kind,
      text,
      ...(meta ? { meta } : {}),
    };
    setList((prev) => pruneNotifications([notif, ...prev]));
  };

  const markRead = () => setLastReadAt(Date.now());

  const clear = () => {
    setList([]);
    setLastReadAt(Date.now());
  };

  // 벨 드롭다운 / unread 카운트 — 토스트 prefs 가 OFF 인 종류는 벨에도 노출하지
  // 않는다. 사용자가 잡음으로 느껴 토스트를 끈 알림은 벨에서도 보고 싶지 않다는
  // 정책 (최근 기록 화면에는 모든 알림이 그대로 누적되어 검색 가능).
  const bellList = list.filter((n) => prefs[n.kind]);

  const unreadCount = bellList.filter((n) => n.timestamp > lastReadAt).length;

  return { list, bellList, unreadCount, add, markRead, clear };
}
