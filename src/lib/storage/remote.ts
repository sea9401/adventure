import { isSyncedKey, type SyncedKey } from "./synced-keys";

export type RemoteSaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; attempts: number; lastError: string }
  | { kind: "session-expired" }
  // 낙관적 동시성 충돌 — 다른 탭/기기가 server 를 갱신했음. 이 탭의 큐는 버려진다.
  // SaveProvider 가 listener 로 받아 location.reload 등으로 처리.
  | { kind: "stale" };

export type RemoteSaveListener = (status: RemoteSaveStatus) => void;

const RETRY_BACKOFF_MS = [1_000, 3_000, 10_000];
const MAX_ATTEMPTS = RETRY_BACKOFF_MS.length + 1;

export type LoadAllResult = {
  data: Partial<Record<SyncedKey, unknown>>;
  versions: Partial<Record<SyncedKey, number>>;
};

export type RemoteSave = {
  loadAll(): Promise<LoadAllResult>;
  patch(key: SyncedKey, value: unknown): void;
  // SaveProvider 가 GET 직후 / 어드민 직접 갱신 후에 호출. 키별 마지막 본 version 을
  // 시드. 시드된 키는 다음 PATCH 에서 expectedVersion 으로 사용된다.
  // 미시드 키는 expectedVersion: null 로 INSERT path 를 탄다.
  seedVersions(versions: Partial<Record<SyncedKey, number>>): void;
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
  // 키별 마지막 본 version. PATCH 시 expectedVersion 으로 사용. undefined = 본 적 없음
  // (= null 로 INSERT path).
  const versionPerKey = new Map<SyncedKey, number>();
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
    if (_status.kind === "session-expired" || _status.kind === "stale") return;

    flushing = true;
    setStatus({ kind: "saving" });

    // 보내는 동안 들어오는 새 patch 는 새 Map 으로 받기.
    const snapshot = new Map(pending);
    pending.clear();

    try {
      for (const [key, value] of snapshot) {
        const expectedVersion = versionPerKey.has(key)
          ? versionPerKey.get(key)
          : null;
        const res = await _fetch(
          `/api/save?key=${encodeURIComponent(key)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value, expectedVersion }),
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
        if (res.status === 409) {
          // 다른 탭/기기가 갱신 — 이 탭의 메모리 state 는 stale. 큐 폐기 + 알림.
          // SaveProvider 가 status listener 로 잡아 reload 등 처리.
          pending.clear();
          setStatus({ kind: "stale" });
          return;
        }
        if (!res.ok) {
          throw new Error(`PATCH ${key} -> ${res.status}`);
        }
        // 성공 응답 본문에서 새 version 을 받아 추적.
        try {
          const body = (await res.json()) as { version?: number };
          if (typeof body.version === "number") {
            versionPerKey.set(key, body.version);
          }
        } catch {
          // 응답 파싱 실패 — 버전 추적 못 함. 다음 PATCH 가 stale 일 수 있음 (드문 경로).
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
      const raw = (await res.json()) as Record<string, unknown>;
      const data: Partial<Record<SyncedKey, unknown>> = {};
      const versions: Partial<Record<SyncedKey, number>> = {};
      const versionMap = (raw["_version"] ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(raw)) {
        if (k === "_version") continue;
        if (isSyncedKey(k)) {
          data[k] = v;
          const ver = versionMap[k];
          if (typeof ver === "number") versions[k] = ver;
        }
      }
      return { data, versions };
    },
    seedVersions(versions) {
      for (const [k, v] of Object.entries(versions)) {
        if (typeof v === "number" && isSyncedKey(k)) {
          versionPerKey.set(k, v);
        }
      }
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
      if (_status.kind === "session-expired" || _status.kind === "stale") return;
      // 디바운스 타이머가 잡혀 있으면 해제 (어차피 지금 다 보냄).
      if (flushTimer) {
        _clearTimeout(flushTimer);
        flushTimer = null;
      }
      const snapshot = new Map(pending);
      pending.clear();
      // 병렬 발사 — await 없음. unload 컨텍스트라 후속 then/catch 가 실행된다 보장 없음.
      // expectedVersion 동봉 — 서버가 stale 이면 PATCH 가 무시됨 (그 시점에 이미 unload 라
      // 클라이언트가 인지할 수 없지만, 데이터 무결성은 보장).
      for (const [key, value] of snapshot) {
        const expectedVersion = versionPerKey.has(key)
          ? versionPerKey.get(key)
          : null;
        try {
          _fetch(`/api/save?key=${encodeURIComponent(key)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value, expectedVersion }),
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
//
// 추가로, 일정 시간 이상 hidden 후 visible 로 복귀하면 location.reload — 그 사이 다른
// 탭/기기에서 server 가 갱신됐을 가능성을 막는 가드. 이 탭의 stale 메모리 state 가
// 다음 patch 에서 server 를 덮어쓰는 (멀티탭 clobber) 시나리오 차단용.
export const RELOAD_AFTER_HIDDEN_MS = 60_000;

export function attachUnloadFlush(remote: RemoteSave) {
  if (typeof window === "undefined") return;
  let hiddenAt: number | null = null;
  const pageHideHandler = () => remote.flushSync();
  const visibilityHandler = () => {
    if (document.visibilityState === "hidden") {
      remote.flushSync();
      hiddenAt = Date.now();
      return;
    }
    if (document.visibilityState === "visible" && hiddenAt !== null) {
      const hiddenMs = Date.now() - hiddenAt;
      hiddenAt = null;
      if (hiddenMs >= RELOAD_AFTER_HIDDEN_MS) {
        window.location.reload();
      }
    }
  };
  window.addEventListener("pagehide", pageHideHandler);
  document.addEventListener("visibilitychange", visibilityHandler);
  return () => {
    window.removeEventListener("pagehide", pageHideHandler);
    document.removeEventListener("visibilitychange", visibilityHandler);
  };
}
