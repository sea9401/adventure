"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 자동 사냥 ON/OFF + 세션 내 영속 + offlineSim flush 브릿지.
//
// - 디폴트 ON. sessionStorage 가 명시적으로 "false" 일 때만 OFF 로 복원 (그 외엔 ON).
// - region 이동/사망 시 setActive(false) → flushRef 가 채워져 있으면 누적 보상 flush.
// - flushRef 는 외부(useOfflineSimulation 호출부)에서 매 render 갱신해 무비용 브릿지.
// - setActiveRaw 는 offline sim onApply 안 등 "flush 재진입을 피해야 하는" 직접 setter 용.
export function useHuntingState() {
  const [active, setActiveState] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("hunting-active") === "false") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveState(false);
      }
    } catch {}
  }, []);

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  });

  const flushRef = useRef<() => void>(() => {});

  const setActive = (next: boolean) => {
    // ON → OFF 전이 시 누적 보상 flush — 사냥 정지 버튼/지역 이동/사망 모두 동일 경로.
    // BattleView 에 머무는 중이면 useOfflineSimulation 의 double-count 가드가 no-op.
    if (activeRef.current && !next) {
      flushRef.current();
    }
    setActiveState(next);
    try {
      sessionStorage.setItem("hunting-active", next ? "true" : "false");
    } catch {}
  };

  // 사망 등 onApply 안에서 직접 OFF 처리 시 사용 — setActive(false) 가 flush 를
  // 트리거해 같은 outbox 를 재진입 적용하는 무한 루프를 피한다. sessionStorage
  // 동기화는 호출자가 직접 수행해야 함.
  const setActiveRaw = setActiveState;

  // ref 를 직접 노출하면 "값 변경 금지" lint 에 걸려, setter 로 감싸 제공.
  // 호출자가 매 render 마다 setFlushHandler(flushFn) 호출 — flushFn 은 stable.
  const setFlushHandler = useCallback((fn: () => void) => {
    flushRef.current = fn;
  }, []);

  return { active, setActive, setActiveRaw, activeRef, setFlushHandler };
}
