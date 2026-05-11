"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { signOut } from "next-auth/react";
import {
  attachUnloadFlush,
  createRemoteSave,
  type RemoteSave,
} from "./remote";
import { MultiTabOverlay } from "./MultiTabGuard";
import { SYNCED_KEYS, type SyncedKey } from "./synced-keys";

const MIGRATION_MARKER_KEY = "migrated.v2";

type SaveData = Partial<Record<SyncedKey, unknown>>;

type ProviderState =
  | { status: "loading" }
  | { status: "ready"; data: SaveData; remote: RemoteSave }
  | { status: "error"; err: string }
  | { status: "session-invalidated" };

const SaveCtx = createContext<{
  initial: SaveData;
  remote: RemoteSave;
} | null>(null);

// 디바이스 단위 영속 세션 ID. 같은 디바이스에선 reload / 새 탭 / 컴퓨터 재시작에도
// 동일 ID 재사용 — 옛 탭의 keepalive PATCH 가 새 마운트의 claim 이후 도착해도
// session ID 가 같아 410 거절 안 됨. 다른 디바이스는 자기 localStorage 가 비어있어
// 새 UUID 생성, claim 시 서버 active_session_id 갱신 → 기존 디바이스 invalidate.
const DEVICE_SESSION_KEY = "device-session-id.v1";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    // SSR — 의미 없는 fallback, 실제 사용은 브라우저에서.
    return "";
  }
  try {
    const existing = localStorage.getItem(DEVICE_SESSION_KEY);
    if (existing && existing.length > 0 && existing.length <= 100) {
      return existing;
    }
  } catch {}
  const fresh =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  try {
    localStorage.setItem(DEVICE_SESSION_KEY, fresh);
  } catch {}
  return fresh;
}

export function SaveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProviderState>({ status: "loading" });
  const remoteRef = useRef<RemoteSave | null>(null);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const remote = createRemoteSave({ sessionId });
    remoteRef.current = remote;
    const detach = attachUnloadFlush(remote);

    let cancelled = false;
    (async () => {
      try {
        // 1) 이 디바이스를 활성 세션으로 claim. 다른 디바이스의 다음 호출은 410.
        //    실패해도 (네트워크 등) 진행 — 첫 GET 도 헤더는 보내니 다른 디바이스가
        //    먼저 claim 한 상태면 그 GET 이 410 으로 바로 처리됨.
        try {
          await fetch("/api/session/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
        } catch {}
        if (cancelled) return;

        const { data: serverData, versions } = await remote.loadAll();
        if (cancelled) return;
        remote.seedVersions(versions);

        // 마이그레이션 — 서버에 없는 키 중 로컬에 있는 걸 일괄 push. 사용자 모달 없음.
        // 마커는 모든 시도가 성공한 경우에만 박음. 부분 실패면 다음 진입에서 누락 키만 재시도.
        // (예전: serverEmpty 만 보고 결정 → 한 번 부분 마이그레이션 후엔 server 가 비지 않아
        // 영원히 재시도 안 됐고, 미전송 키는 영구 손실.)
        let final: SaveData = serverData;
        const alreadyMigrated =
          typeof window !== "undefined" &&
          localStorage.getItem(MIGRATION_MARKER_KEY) === "1";

        if (!alreadyMigrated) {
          const toMigrate: SaveData = {};
          for (const key of SYNCED_KEYS) {
            // 서버에 이미 있는 키는 건너뛰기 — 로컬이 더 옛날일 수 있어 덮으면 안 됨.
            if (serverData[key] !== undefined) continue;
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                toMigrate[key] = JSON.parse(raw);
              } catch {}
            }
          }
          if (Object.keys(toMigrate).length > 0) {
            for (const [k, v] of Object.entries(toMigrate)) {
              remote.patch(k as SyncedKey, v);
            }
            try {
              await remote.flush();
              // 모두 성공 — marker 박음 + 메모리 final 에 합침.
              localStorage.setItem(MIGRATION_MARKER_KEY, "1");
              final = { ...serverData, ...toMigrate };
            } catch {
              // 부분 실패 — marker 안 박음. 다음 진입에서 server 에 아직 없는 키만 재시도.
              // (이번에 성공한 키는 다음 mount 의 serverData 에 포함돼 자연스레 skip 됨.)
            }
          } else {
            // 옮길 게 없음 — 마이그레이션 완료로 본다.
            localStorage.setItem(MIGRATION_MARKER_KEY, "1");
          }
        }

        setState({ status: "ready", data: final, remote });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          err: e instanceof Error ? e.message : String(e),
        });
      }
    })();

    // 낙관적 동시성 충돌 — 다른 탭/기기가 server 를 갱신해 이 탭의 expectedVersion 이
    // 어긋남. 메모리 state 를 신뢰할 수 없으니 reload 로 fresh server 데이터 다시 로드.
    //
    // 일관성 우선 — reload 전에 살아남은 키를 flushSync 하지 *않는다*. 예전엔 충돌 안 난
    // 키들을 keepalive 로 발사했지만, 그러면 "살아남은 키 = 이 디바이스 값 / 폐기된 키 =
    // 서버 값" 으로 한 캐릭터 상태가 두 디바이스 값으로 찢어진다 (예: 인벤토리엔 새 드롭이
    // 있는데 그걸 산 골드는 옛날값으로 롤백). 그냥 reload → loadAll() 로 모든 키를 서버
    // 기준 + 각 hook 의 localStorage-merge 경로로 일괄 채택하는 게 coherent. 손실은 "마지막
    // 성공 sync 이후 이 디바이스가 한 것" 으로 한정 — 이게 멀티 디바이스 충돌의 정확한 의미론.
    //
    // session-invalidated — 다른 디바이스가 새 세션 claim 함. 이 디바이스의 PATCH 는
    // 이제 항상 410. Clerk signOut + 안내 화면. flushSync 안 함 (어차피 410).
    const unsubscribe = remote.subscribe((s) => {
      if (s.kind === "stale" && typeof window !== "undefined") {
        // droppedKeys 가 있으면 (409 한도 초과로 폐기된 변경) 어떤 데이터가
        // 영향받았는지 사용자에게 알린다.
        const dropped = s.droppedKeys ?? [];
        const message =
          dropped.length > 0
            ? `다른 기기/탭의 진행과 충돌해 서버 기준으로 다시 불러왔습니다. 이 기기의 최근 변경 일부(${dropped.join(", ")})는 반영되지 않았을 수 있습니다.`
            : "다른 기기/탭에서 갱신을 감지해 새로 불러왔습니다.";
        try {
          localStorage.setItem("pending-reload-toast.v1", message);
        } catch {}
        window.location.reload();
      }
      if (s.kind === "session-invalidated") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({ status: "session-invalidated" });
      }
    });

    return () => {
      cancelled = true;
      detach?.();
      unsubscribe();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          데이터 불러오는 중...
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="max-w-sm text-center">
          <div className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            데이터를 불러오지 못했습니다
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {state.err}
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (state.status === "session-invalidated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="max-w-sm text-center">
          <div className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            다른 디바이스에서 로그인됐습니다
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            동시 접속을 막기 위해 이 세션은 종료됩니다. 이 디바이스에서 계속 플레이하려면
            로그아웃 후 다시 로그인하세요.
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await signOut({ redirectTo: "/sign-in" });
            } catch {}
            window.location.href = "/sign-in";
          }}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <SaveCtx.Provider value={{ initial: state.data, remote: state.remote }}>
      {children}
      <MultiTabOverlay />
    </SaveCtx.Provider>
  );
}

// hook — Context 에서 특정 키의 초기값 꺼내옴. 마운트 시 한 번만 의미가 있음.
export function useSavedValue<T = unknown>(key: SyncedKey): T | undefined {
  const ctx = useContext(SaveCtx);
  if (!ctx) {
    throw new Error("useSavedValue must be used inside <SaveProvider>");
  }
  return ctx.initial[key] as T | undefined;
}

// hook — 변경 사항을 서버로 보낼 때 사용.
export function useRemoteSave(): RemoteSave {
  const ctx = useContext(SaveCtx);
  if (!ctx) {
    throw new Error("useRemoteSave must be used inside <SaveProvider>");
  }
  return ctx.remote;
}
