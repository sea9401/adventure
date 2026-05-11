import { useEffect, useState } from "react";
import {
  genNotificationId,
  isBattleNotification,
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

  // 벨 드롭다운에 노출되는 목록 — 전투 승/패는 '최근 기록 → 전투 로그' 탭 전용이라
  // 벨에선 제외 (시스템 알림만). 최근 기록·토스트에는 영향 없음.
  const bellList = list.filter((n) => !isBattleNotification(n.kind));

  // 벨 unread 카운트 — bellList 는 이미 전투 승/패를 뺀 상태. 거기서 또 잡음이 많은
  // loot·info 를 제외해야 배지가 의미 있는 이벤트(성취·의뢰·원정 등)에만 반응한다.
  // 토스트 노출 여부는 별도로 useToastPrefs 의 사용자 설정이 단일 source-of-truth.
  const unreadCount = bellList
    .filter((n) => n.kind !== "loot" && n.kind !== "info")
    .filter((n) => n.timestamp > lastReadAt).length;

  return { list, bellList, unreadCount, add, markRead, clear };
}
