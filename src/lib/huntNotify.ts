"use client";

// 자동 사냥 알림 — 사망 예측 시각 / 4시간 완료 시각에 발화.
//
// 3중 채널: (1) 탭 title flash, (2) favicon swap (data URI SVG emoji), (3) Web Notification API (OS 알림).
// 토글(localStorage) OFF 면 모두 no-op. Permission 은 토글 ON 시점에 한 번 요청.
//
// 사용자가 탭으로 돌아오면(visibilitychange → !hidden) title/favicon 자동 복원.
// OS 알림은 페이지가 살아 있을 때만 발화 가능 (Service Worker 미사용 — 그건 후속 작업).

const NOTIF_TOGGLE_KEY = "auto-hunt-notif.v1";

export function getHuntNotifEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIF_TOGGLE_KEY) === "1";
}

export function setHuntNotifEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) localStorage.setItem(NOTIF_TOGGLE_KEY, "1");
  else localStorage.removeItem(NOTIF_TOGGLE_KEY);
}

export type NotifPermission = "granted" | "denied" | "default" | "unsupported";

export function getNotifPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotifPermission;
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission !== "default") {
    return Notification.permission as NotifPermission;
  }
  const result = await Notification.requestPermission();
  return result as NotifPermission;
}

// ── tab title flash ───────────────────────────────────────────────────────────
let originalTitle: string | null = null;
let titleFlashInterval: ReturnType<typeof setInterval> | null = null;
let visibilityHandlerInstalled = false;

function ensureVisibilityHandler() {
  if (visibilityHandlerInstalled || typeof document === "undefined") return;
  visibilityHandlerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) clearFlash();
  });
}

function flashTitle(message: string) {
  if (typeof document === "undefined") return;
  if (!document.hidden) return; // foreground 면 굳이 깜빡이지 않음 (OS notif 만)
  if (originalTitle === null) originalTitle = document.title;
  if (titleFlashInterval) clearInterval(titleFlashInterval);
  let toggle = false;
  document.title = `🔔 ${message}`;
  titleFlashInterval = setInterval(() => {
    toggle = !toggle;
    if (originalTitle !== null) {
      document.title = toggle ? originalTitle : `🔔 ${message}`;
    }
  }, 1500);
  ensureVisibilityHandler();
}

// ── favicon swap (emoji SVG data URI) ─────────────────────────────────────────
let originalFaviconHref: string | null = null;
let faviconLinkEl: HTMLLinkElement | null = null;

function getFaviconLink(): HTMLLinkElement | null {
  if (typeof document === "undefined") return null;
  if (faviconLinkEl && document.contains(faviconLinkEl)) return faviconLinkEl;
  faviconLinkEl = document.querySelector(
    "link[rel~='icon']",
  ) as HTMLLinkElement | null;
  return faviconLinkEl;
}

function flashFavicon(emoji: string) {
  const link = getFaviconLink();
  if (!link) return;
  if (originalFaviconHref === null) originalFaviconHref = link.href;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="55" text-anchor="middle" dominant-baseline="central" font-size="80">${emoji}</text></svg>`;
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function clearFlash() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  if (originalTitle !== null && typeof document !== "undefined") {
    document.title = originalTitle;
    originalTitle = null;
  }
  if (originalFaviconHref !== null) {
    const link = getFaviconLink();
    if (link) link.href = originalFaviconHref;
    originalFaviconHref = null;
  }
}

/** 외부에서 명시적으로 알림 잔재를 정리. (collect 후 등.) */
export function clearHuntNotif(): void {
  clearFlash();
}

// ── 통합 알림 발화 ────────────────────────────────────────────────────────────
export type HuntNotifKind = "death" | "complete";

const TITLES: Record<HuntNotifKind, string> = {
  death: "자동 사냥 중 사망",
  complete: "자동 사냥 완료",
};
const EMOJIS: Record<HuntNotifKind, string> = {
  death: "💀",
  complete: "🎯",
};

export function notifyHunt(kind: HuntNotifKind, body: string): void {
  if (!getHuntNotifEnabled()) return;
  const title = TITLES[kind];
  flashTitle(title);
  flashFavicon(EMOJIS[kind]);
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      // 권한 변경 race 등 — 무시.
    }
  }
}
