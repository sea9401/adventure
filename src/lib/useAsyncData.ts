"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncDataState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 수동 재조회 — 같은 deps 로 fetcher 를 다시 실행. */
  refetch: () => void;
};

/**
 * fetch + loading/error 라이프사이클 공용 훅.
 *
 * - `deps` 가 바뀌면 자동 재조회. 언마운트/deps 변경 시 in-flight 응답은 버림(AbortController).
 * - `opts.enabled === false` 면 호출하지 않고 초기 상태 유지 (조건부 페치).
 * - `fetcher` 는 안정 참조일 필요 없음 — ref 로 최신본을 잡아 effect deps 에서 제외.
 * - 재조회 시작 시 기존 `data` 는 유지(깜빡임 방지) — 성공 시에만 교체.
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[] = [],
  opts: { enabled?: boolean; errorMessage?: string } = {},
): AsyncDataState<T> {
  const enabled = opts.enabled ?? true;
  const errorMessage = opts.errorMessage ?? "데이터를 불러오지 못했습니다.";
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // 최신 fetcher 를 ref 에 보관 — effect deps 에서 제외해 "fetcher 가 매 렌더 새 클로저"여도
  // 재조회가 트리거되지 않게. (ref 쓰기는 render 가 아니라 effect 안에서.)
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    // loading/error 는 비동기 응답까지 살아있는 외부 상태 동기화 — effect 안에서 set 가 정상.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetcherRef
      .current(ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : errorMessage);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, refetch };
}
