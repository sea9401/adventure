"use client";

import { useEffect, useState } from "react";
import type { NotificationKind } from "@/lib/notifications";

// 토스트 알림 종류별 on/off 선호. 디바이스별 설정 — 서버 sync 대상이 아님.
// 벨/최근 기록에는 모든 알림이 항상 누적되며, 이 옵션은 토스트 표시 여부에만 영향.

export const TOAST_PREFS_STORAGE_KEY = "notification-prefs.v1";

// 같은 탭에서의 변경을 다른 hook 인스턴스에 알리기 위한 커스텀 이벤트.
// (storage 이벤트는 다른 탭에서만 발화한다.)
const PREF_CHANGE_EVENT = "notification-prefs-change";

export type ToastPrefs = Record<NotificationKind, boolean>;

// 기본값 — 모든 종류가 prefs 패널에서 토글 가능. 다음 기준으로 디폴트 결정:
// - battle_win / loot / info: 너무 자주 발화되어 토스트로 두면 잡음 — 기본 OFF.
// - battle_lose / expedition: 사망·원정 결과는 눈에 띄는 모달을 따로 띄우므로
//   중복 토스트는 기본 OFF. (원하면 사용자가 켤 수 있음)
// - training_done / quest_ready / quest_complete / milestone / item:
//   드물거나 직접 누른 액션의 즉시 피드백 — 기본 ON.
const DEFAULTS: ToastPrefs = {
  battle_win: false,
  battle_lose: false,
  training_done: true,
  quest_ready: true,
  quest_complete: true,
  milestone: true,
  expedition: false,
  loot: false,
  item: true,
  info: false,
};

export function readToastPrefs(): ToastPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(TOAST_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ToastPrefs> | null;
    return { ...DEFAULTS, ...(parsed ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

function writeToastPrefs(prefs: ToastPrefs): void {
  try {
    localStorage.setItem(TOAST_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(PREF_CHANGE_EVENT));
  } catch {}
}

export function useToastPrefs(): {
  prefs: ToastPrefs;
  setPref: (kind: NotificationKind, enabled: boolean) => void;
} {
  const [prefs, setPrefs] = useState<ToastPrefs>(readToastPrefs);

  useEffect(() => {
    const refresh = () => setPrefs(readToastPrefs());
    window.addEventListener(PREF_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PREF_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const setPref = (kind: NotificationKind, enabled: boolean) => {
    // 함수형 업데이트 — 같은 렌더 안에서 여러 번 빠르게 토글해도 직전 토글이
    // 묻히지 않도록 prev 에서 다음 상태를 계산하고 그 상태를 영속화한다.
    setPrefs((prev) => {
      const next: ToastPrefs = { ...prev, [kind]: enabled };
      writeToastPrefs(next);
      return next;
    });
  };

  return { prefs, setPref };
}

// UI 라벨 — 모달에서 종류별로 노출. 코드 식별자보다 사람이 읽기 좋은 한국어.
export const TOAST_KIND_LABELS: Record<
  NotificationKind,
  { name: string; description: string }
> = {
  battle_win: {
    name: "전투 승리",
    description: "몬스터를 처치했을 때 표시.",
  },
  battle_lose: {
    name: "전투 패배",
    description: "전투에서 패배해 시작 마을로 이동했을 때 표시.",
  },
  training_done: {
    name: "훈련 완료",
    description: "능력치 단련이 끝났을 때 표시.",
  },
  quest_ready: {
    name: "의뢰 조건 달성",
    description: "의뢰 목표를 채워 길드에서 보상 수령이 가능해졌을 때.",
  },
  quest_complete: {
    name: "의뢰 완료",
    description: "의뢰 보상을 받았을 때 표시.",
  },
  milestone: {
    name: "성취",
    description: "레벨업·스킬 습득·칭호 획득 등 성장 이벤트.",
  },
  expedition: {
    name: "위탁 원정",
    description: "자동 사냥(위탁 원정) 결과가 도착했을 때 표시.",
  },
  loot: {
    name: "전리품",
    description: "전투에서 재료·골드·장비·제작서를 얻었을 때.",
  },
  item: {
    name: "장비 액션",
    description: "제작·장착·해제·폐기 등 장비를 다뤘을 때 우하단에 잠깐 표시.",
  },
  info: {
    name: "일반 알림",
    description: "이동·판매·상점 해금 등 그 외 일반적인 정보.",
  },
};

export const TOAST_KIND_ORDER: NotificationKind[] = [
  "milestone",
  "quest_ready",
  "quest_complete",
  "expedition",
  "item",
  "training_done",
  "loot",
  "battle_win",
  "battle_lose",
  "info",
];
