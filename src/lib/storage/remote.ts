import { isSyncedKey, type SyncedKey } from "./synced-keys";

export type RemoteSaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; attempts: number; lastError: string }
  | { kind: "session-expired" }
  // 낙관적 동시성 충돌 — 다른 탭/기기가 server 를 갱신했음. 이 탭의 큐는 버려진다.
  // SaveProvider 가 listener 로 받아 location.reload 등으로 처리.
  | { kind: "stale" }
  // 다른 디바이스가 새 세션을 claim 함 — 서버가 410 으로 거절. SaveProvider 가
  // listener 로 받아 Clerk signOut + 안내 모달 처리.
  | { kind: "session-invalidated" };

export type RemoteSaveListener = (status: RemoteSaveStatus) => void;

const RETRY_BACKOFF_MS = [1_000, 3_000, 10_000];
const MAX_ATTEMPTS = RETRY_BACKOFF_MS.length + 1;

// 409 (낙관적 동시성 충돌) 시 같은 키에 대해 허용하는 자동 재시도 횟수.
// 이 한도까지는 server 가 알려준 currentVersion 으로 expectedVersion 을 갱신해
// 같은 값을 재발사 (last-writer-wins) — 멀티탭은 BroadcastChannel 가드가 이미
// 막아주므로 대부분의 409 는 일시적 race / 첫 mount 시 seed 누락. 한도를 넘어가면
// 진짜 멀티 디바이스 활성 편집으로 보고 stale → SaveProvider 가 reload.
const MAX_KEY_CONFLICT_RETRIES = 3;

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
  /** 단일 세션 enforce 용 토큰 — 모든 PATCH/GET 의 X-Session-Id 헤더로 동봉. */
  sessionId?: string;
};

export function createRemoteSave(options: Options = {}): RemoteSave {
  const flushDelayMs = options.flushDelayMs ?? 500;
  const _fetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const _setTimeout = options.setTimeoutImpl ?? globalThis.setTimeout;
  const _clearTimeout = options.clearTimeoutImpl ?? globalThis.clearTimeout;
  const sessionId = options.sessionId;
  const sessionHeader: Record<string, string> = sessionId
    ? { "X-Session-Id": sessionId }
    : {};

  // 같은 키로 들어온 patch 는 항상 최신값으로 덮어쓰기.
  const pending = new Map<SyncedKey, unknown>();
  // 키별 마지막 본 version. PATCH 시 expectedVersion 으로 사용. undefined = 본 적 없음
  // (= null 로 INSERT path).
  const versionPerKey = new Map<SyncedKey, number>();
  // 키별 연속 409 카운트. 성공 시 0 으로 리셋. MAX_KEY_CONFLICT_RETRIES 까지는
  // currentVersion 갱신 + 재발사로 자동 회복, 그 이상이면 stale 처리.
  const conflictCount = new Map<SyncedKey, number>();
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
    // 한 키가 stale 한도까지 가도 다른 키는 살림. snapshot 순회는 끝까지 가고 마지막에
    // overall status 를 stale 로 표기. SaveProvider 가 reload 직전 flushSync 로 살아남은
    // 다른 키들을 keepalive 로 발사 — cross-key 일괄 손실 차단.
    let staleEncountered = false;

    try {
      for (const [key, value] of snapshot) {
        const expectedVersion = versionPerKey.has(key)
          ? versionPerKey.get(key)
          : null;
        const res = await _fetch(
          `/api/save?key=${encodeURIComponent(key)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...sessionHeader },
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
        if (res.status === 410) {
          // 다른 디바이스가 새 세션 claim — 이 디바이스는 무효. SaveProvider 가
          // listener 로 받아 Clerk signOut + 안내. 큐 폐기.
          pending.clear();
          setStatus({ kind: "session-invalidated" });
          return;
        }
        if (res.status === 409) {
          // 낙관적 동시성 충돌 — server 의 currentVersion 으로 expectedVersion 을 갱신해
          // 자동 재시도 (last-writer-wins). MAX_KEY_CONFLICT_RETRIES 한도까지만.
          // 한도 초과 = 진짜 멀티 디바이스 활성 편집. 이 키만 폐기하고 다른 키는 계속 처리.
          const count = (conflictCount.get(key) ?? 0) + 1;
          if (count > MAX_KEY_CONFLICT_RETRIES) {
            conflictCount.delete(key);
            // 이 키만 큐/추적에서 제외. snapshot 의 나머지 키는 계속 PATCH.
            staleEncountered = true;
            continue;
          }
          conflictCount.set(key, count);
          try {
            const body = (await res.json()) as { currentVersion?: number };
            if (typeof body.currentVersion === "number") {
              versionPerKey.set(key, body.currentVersion);
            } else {
              versionPerKey.delete(key);
            }
          } catch {
            versionPerKey.delete(key);
          }
          // 같은 값을 다음 사이클에 재발사. 그 사이 더 새로운 값이 왔으면 그게 우선.
          if (!pending.has(key)) pending.set(key, value);
          continue;
        }
        if (!res.ok) {
          throw new Error(`PATCH ${key} -> ${res.status}`);
        }
        // 성공 — 카운트 리셋 + 새 version 추적.
        conflictCount.delete(key);
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
      // flush 중에 새로 쌓인 게 있으면 다음 사이클로 — flushing=false 이후에 schedule
      // 해야 scheduleFlush 의 (flushTimer || flushing) 가드가 통과한다.
      if (staleEncountered) {
        setStatus({ kind: "stale" });
      } else if (pending.size === 0) {
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
      // 재시도 큐가 남아있으면 (409 retry / 401 보존) 다음 디바운스 사이클로 예약.
      // error 는 catch 분기가 자체 backoff timer 를 잡아두므로 여기선 건드리지 않음.
      // stale/session-expired 는 큐가 이미 폐기됐거나 (stale) 보존돼 (401) — 어느 쪽이든
      // 자동 재발사 X. setStatus 가 _status 를 외부 클로저로 갱신하므로 TS 의 narrowing
      // 을 피하기 위해 string 변수로 한 번 우회.
      const kind: string = _status.kind;
      if (
        pending.size > 0 &&
        kind !== "stale" &&
        kind !== "session-expired" &&
        kind !== "error"
      ) {
        scheduleFlush();
      }
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
      const res = await _fetch("/api/save", {
        cache: "no-store",
        headers: { ...sessionHeader },
      });
      if (res.status === 401) {
        setStatus({ kind: "session-expired" });
        throw new Error("session expired");
      }
      if (res.status === 410) {
        setStatus({ kind: "session-invalidated" });
        throw new Error("session invalidated");
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
      // session-expired 는 인증 만료라 어차피 401. session-invalidated 는 다른 디바이스
      // 가 점령 — 발사하면 410. 둘 다 의미 없으니 차단. stale 은 어떤 한 키가 한도 초과한
      // 케이스 — 충돌 안 난 다른 키들은 expectedVersion 으로 안전하게 발사 가능.
      if (
        _status.kind === "session-expired" ||
        _status.kind === "session-invalidated"
      ) {
        return;
      }
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
            headers: { "Content-Type": "application/json", ...sessionHeader },
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
// 옛 버전엔 "장시간 hidden 후 visible 복귀 시 자동 reload" 가드가 있었지만 제거함:
// 1) 멀티 디바이스 clobber 는 expectedVersion(409)→stale→SaveProvider reload 로 이미 잡힘
// 2) 다른 디바이스 활성 진입은 active_session_id 로 410 → session-invalidated 처리
// 3) 모바일 화면 잠금이 트리거가 자주 돼 옵티미스틱 sim 결과가 navigate race 로 손실되는
//    사고를 만들었음. 다른 방어 장치들과 중복이라 제거가 깔끔.
export function attachUnloadFlush(remote: RemoteSave) {
  if (typeof window === "undefined") return;
  const pageHideHandler = () => remote.flushSync();
  const visibilityHandler = () => {
    if (document.visibilityState === "hidden") remote.flushSync();
  };
  window.addEventListener("pagehide", pageHideHandler);
  document.addEventListener("visibilitychange", visibilityHandler);
  return () => {
    window.removeEventListener("pagehide", pageHideHandler);
    document.removeEventListener("visibilitychange", visibilityHandler);
  };
}
