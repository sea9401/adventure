"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  | { status: "error"; err: string };

const SaveCtx = createContext<{
  initial: SaveData;
  remote: RemoteSave;
} | null>(null);

export function SaveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProviderState>({ status: "loading" });
  const remoteRef = useRef<RemoteSave | null>(null);

  useEffect(() => {
    const remote = createRemoteSave();
    remoteRef.current = remote;
    const detach = attachUnloadFlush(remote);

    let cancelled = false;
    (async () => {
      try {
        const { data: serverData, versions } = await remote.loadAll();
        if (cancelled) return;
        remote.seedVersions(versions);

        // 서버가 비어 있고 로컬에 데이터가 있고 마이그레이션 마커가 없으면
        // 일괄 push (자동 마이그레이션). 사용자 모달 없음.
        let final: SaveData = serverData;
        const serverEmpty = Object.keys(serverData).length === 0;
        const alreadyMigrated =
          typeof window !== "undefined" &&
          localStorage.getItem(MIGRATION_MARKER_KEY) === "1";

        if (serverEmpty && !alreadyMigrated) {
          const local: SaveData = {};
          for (const key of SYNCED_KEYS) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                local[key] = JSON.parse(raw);
              } catch {}
            }
          }
          if (Object.keys(local).length > 0) {
            for (const [k, v] of Object.entries(local)) {
              remote.patch(k as SyncedKey, v);
            }
            try {
              await remote.flush();
              // 성공한 경우만 마커 박음 — 실패하면 다음 진입 때 재시도.
              localStorage.setItem(MIGRATION_MARKER_KEY, "1");
              final = local;
            } catch {
              // flush 실패 — 일단 서버 데이터(빈) 로 시작하고 다음번에 재시도.
            }
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
    const unsubscribe = remote.subscribe((s) => {
      if (s.kind === "stale" && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "pending-reload-toast.v1",
            "다른 기기/탭에서 갱신을 감지해 새로 불러왔습니다.",
          );
        } catch {}
        window.location.reload();
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
