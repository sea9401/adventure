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

  // 벨 unread 카운트는 잡음이 많은 battle_win·info 를 그대로 두면 끊임없이
  // 깜빡여 의미가 옅어진다 — 두 종류는 unread 집계에서만 제외.
  // 토스트 노출 여부는 별도로 useToastPrefs 의 사용자 설정이 단일 source-of-truth.
  const unreadCount = list
    .filter((n) => n.kind !== "battle_win" && n.kind !== "info")
    .filter((n) => n.timestamp > lastReadAt).length;

  return { list, unreadCount, add, markRead, clear };
}
