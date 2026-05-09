import { isSyncedKey, type SyncedKey } from "./synced-keys";

export type RemoteSaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; attempts: number; lastError: string }
  | { kind: "session-expired" };

export type RemoteSaveListener = (status: RemoteSaveStatus) => void;

const RETRY_BACKOFF_MS = [1_000, 3_000, 10_000];
const MAX_ATTEMPTS = RETRY_BACKOFF_MS.length + 1;

export type RemoteSave = {
  loadAll(): Promise<Partial<Record<SyncedKey, unknown>>>;
  patch(key: SyncedKey, value: unknown): void;
  flush(): Promise<void>;
  // unload 직전 등 비동기 await 가 보장되지 않는 컨텍스트 전용. 모든 pending PATCH 를
  // keepalive 옵션으로 병렬 발사하고 즉시 리턴 — 결과는 무시. fetch keepalive 는
  // 페이지 종료 후에도 브라우저가 요청을 살려 보낸다 (~64KB body 한도).
  flushSync(): void;
  status(): RemoteSaveStatus;
  subscribe(listener: RemoteSaveListener): () => void;
};

type Options = {
  flushDelayMs?: number;
  fetchImpl?: typeof fetch;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
};

export function createRemoteSave(options: Options = {}): RemoteSave {
  const flushDelayMs = options.flushDelayMs ?? 500;
  const _fetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const _setTimeout = options.setTimeoutImpl ?? globalThis.setTimeout;
  const _clearTimeout = options.clearTimeoutImpl ?? globalThis.clearTimeout;

  // 같은 키로 들어온 patch 는 항상 최신값으로 덮어쓰기.
  const pending = new Map<SyncedKey, unknown>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;
  let attempts = 0;
  let _status: RemoteSaveStatus = { kind: "idle" };
  const listeners = new Set<RemoteSaveListener>();

  const setStatus = (next: RemoteSaveStatus) => {
    _status = next;
    for (const l of listeners) l(next);
  };

  const flushNow = async (): Promise<void> => {
    if (flushTimer) {
      _clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (flushing) return;
    if (pending.size === 0) {
      setStatus({ kind: "idle" });
      return;
    }
    if (_status.kind === "session-expired") return;

    flushing = true;
    setStatus({ kind: "saving" });

    // 보내는 동안 들어오는 새 patch 는 새 Map 으로 받기.
    const snapshot = new Map(pending);
    pending.clear();

    try {
      for (const [key, value] of snapshot) {
        const res = await _fetch(
          `/api/save?key=${encodeURIComponent(key)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          },
        );
        if (res.status === 401) {
          setStatus({ kind: "session-expired" });
          // 못 보낸 키는 큐에 되돌려 다음 로그인 후 재시도.
          for (const [k, v] of snapshot) {
            if (!pending.has(k)) pending.set(k, v);
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`PATCH ${key} -> ${res.status}`);
        }
      }
      attempts = 0;
      // flush 중에 새로 쌓인 게 있으면 다음 사이클로.
      if (pending.size > 0) {
        scheduleFlush();
      } else {
        setStatus({ kind: "idle" });
      }
    } catch (err) {
      attempts += 1;
      const msg = err instanceof Error ? err.message : String(err);
      // 보냈던 snapshot 은 다시 pending 으로 (이미 들어온 더 새로운 값이 있으면 보존).
      for (const [k, v] of snapshot) {
        if (!pending.has(k)) pending.set(k, v);
      }
      if (attempts >= MAX_ATTEMPTS) {
        setStatus({ kind: "error", attempts, lastError: msg });
      } else {
        setStatus({ kind: "error", attempts, lastError: msg });
        const backoff = RETRY_BACKOFF_MS[attempts - 1];
        flushTimer = _setTimeout(() => {
          flushTimer = null;
          flushNow();
        }, backoff);
      }
    } finally {
      flushing = false;
    }
  };

  const scheduleFlush = () => {
    if (flushTimer || flushing) return;
    flushTimer = _setTimeout(() => {
      flushTimer = null;
      flushNow();
    }, flushDelayMs);
  };

  return {
    async loadAll() {
      const res = await _fetch("/api/save", { cache: "no-store" });
      if (res.status === 401) {
        setStatus({ kind: "session-expired" });
        throw new Error("session expired");
      }
      if (!res.ok) throw new Error(`GET /api/save -> ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;
      const out: Partial<Record<SyncedKey, unknown>> = {};
      for (const [k, v] of Object.entries(data)) {
        if (isSyncedKey(k)) out[k] = v;
      }
      return out;
    },
    patch(key, value) {
      pending.set(key, value);
      scheduleFlush();
    },
    async flush() {
      await flushNow();
    },
    flushSync() {
      if (pending.size === 0) return;
      if (_status.kind === "session-expired") return;
      // 디바운스 타이머가 잡혀 있으면 해제 (어차피 지금 다 보냄).
      if (flushTimer) {
        _clearTimeout(flushTimer);
        flushTimer = null;
      }
      const snapshot = new Map(pending);
      pending.clear();
      // 병렬 발사 — await 없음. unload 컨텍스트라 후속 then/catch 가 실행된다 보장 없음.
      for (const [key, value] of snapshot) {
        try {
          _fetch(`/api/save?key=${encodeURIComponent(key)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
            keepalive: true,
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
    },
    status() {
      return _status;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// 페이지 종료/숨김 시 마지막 변경분 강제 전송. fetch keepalive 옵션으로 unload 후에도
// 요청이 살아남게 함. pagehide 와 visibilitychange→hidden 둘 다 잡아 모바일 사파리·
// 백그라운드 탭 종료까지 커버. beforeunload 는 모바일에서 신뢰도 낮아 제외.
export function attachUnloadFlush(remote: RemoteSave) {
  if (typeof window === "undefined") return;
  const handler = () => remote.flushSync();
  const visibilityHandler = () => {
    if (document.visibilityState === "hidden") remote.flushSync();
  };
  window.addEventListener("pagehide", handler);
  document.addEventListener("visibilitychange", visibilityHandler);
  return () => {
    window.removeEventListener("pagehide", handler);
    document.removeEventListener("visibilitychange", visibilityHandler);
  };
}
