// 오프라인 사냥 보상의 "outbox" — onApply 직후 outbox 에 박아두고, PATCH 사이클이
// saving→idle 로 정착하면 비운다. 그 사이에 stale-conflict 가 reload 를 트리거해도
// outbox 가 localStorage 에 남아 다음 mount 에서 같은 결과를 그대로 재적용 → 보상 손실 차단.
//
// 익스플로잇 방지: userId 가 일치하지 않으면 (다른 계정으로 로그인 등) 무시 + 정리.
//
// 트레이드오프: keepalive PATCH 가 모두 성공한 직후에 reload 되는 드문 경우, outbox 가
// 비워지지 않은 채 mount 에서 재적용되면 보상이 한 번 더 들어갈 수 있다. 손실보다 중복이
// 사용자 체감상 덜 뼈아프므로 의도적으로 이 트레이드오프 채택.

import type { OfflineSimResult } from "./offlineSim";

const OUTBOX_KEY = "offline-reward-pending.v1";

type StoredOutbox = {
  result: OfflineSimResult;
  userId: string | null;
  writtenAt: number;
};

export function readRewardOutbox(
  currentUserId: string | null,
): OfflineSimResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredOutbox> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.result || typeof parsed.result !== "object") return null;
    // 다른 계정 outbox — 그대로 두면 영원히 남아 leak 이므로 정리.
    if ((parsed.userId ?? null) !== currentUserId) {
      try {
        window.localStorage.removeItem(OUTBOX_KEY);
      } catch {}
      return null;
    }
    return parsed.result as OfflineSimResult;
  } catch {
    return null;
  }
}

export function writeRewardOutbox(
  result: OfflineSimResult,
  userId: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredOutbox = {
      result,
      userId,
      writtenAt: Date.now(),
    };
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(payload));
  } catch {}
}

export function clearRewardOutbox(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OUTBOX_KEY);
  } catch {}
}
