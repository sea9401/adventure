"use client";

import { getTitle } from "@/adventure/data/titles";
import type { useAdventureLog } from "@/adventure/log/useAdventureLog";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";

// 칭호 부여 — idempotent. 신규로 등록되는 시점에만 토스트 ("획득 시"가 트리거).
// 이미 획득한 칭호엔 무반응 (markTitleObtained 자체가 idempotent).
// page.tsx 초기(캐릭터 합성 전)에 호출 가능하도록 deps 를 adventureLog + addNotification 만 받는다.

// 5막 잔영 협동 legend 칭호 셋. 셋 다 보유 시 컬렉션 칭호(starlit_quietener)를 함께 grant.
const STARLIT_BREAKER_TITLES = [
  "starlit_giant_breaker",
  "starlit_depth_breaker",
  "starlit_gate_breaker",
] as const;

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

    // 잔영 셋 가라앉힘 — 마지막 breaker 가 들어오는 그 순간에 컬렉션 칭호도 한꺼번에 부여.
    // markTitleObtained 가 idempotent 이고, 이 함수 자체도 idempotent (다음 호출은 위 ‘이미 보유’
    // 가드에서 no-op). 같은 turn 안에 같은 adventureLog 인스턴스의 로그 갱신은 동기 반영된다.
    if (
      (STARLIT_BREAKER_TITLES as readonly string[]).includes(titleId) &&
      STARLIT_BREAKER_TITLES.every((id) => adventureLog.log.titles[id])
    ) {
      grantTitle("starlit_quietener");
    }
  };

  return { grantTitle };
}
