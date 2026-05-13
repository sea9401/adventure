"use client";

import { getTitle } from "@/adventure/data/titles";
import type { useAdventureLog } from "@/adventure/log/useAdventureLog";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";

// 칭호 부여 — idempotent. 신규로 등록되는 시점에만 토스트 ("획득 시"가 트리거).
// 이미 획득한 칭호엔 무반응 (markTitleObtained 자체가 idempotent).
// page.tsx 초기(캐릭터 합성 전)에 호출 가능하도록 deps 를 adventureLog + addNotification 만 받는다.
export function useTitleGrant(deps: {
  adventureLog: ReturnType<typeof useAdventureLog>;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
}) {
  const { adventureLog, addNotification } = deps;

  const grantTitle = (titleId: string) => {
    if (adventureLog.log.titles[titleId]) return;
    adventureLog.markTitleObtained(titleId);
    const title = getTitle(titleId);
    if (title) addNotification("milestone", `칭호 획득 — ${title.name}`);
  };

  return { grantTitle };
}
