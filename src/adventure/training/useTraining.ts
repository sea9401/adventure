import { useEffect, useMemo, useState } from "react";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";

export const TRAINING_DURATION_MS = 12 * 60 * 60 * 1000;

type TrainingPersisted = {
  endsAt: number | null;
  points: number;
  allocated: Record<StatKey, number>;
  // 되돌리기(스탯 차감) 에 필요한 별도 포인트. 첫 시작 시 10개 지급.
  revertPoints: number;
  // 누적 완료 횟수 — 칭호 마일스톤 트리거에 사용.
  completedCount: number;
};

// 첫 시작 보너스 — 신규 유저 + 기존 유저(아직 revertPoints 필드 미저장) 모두 10 부여.
// 기존에 0 으로 명시 저장된 유저는 그대로 0 유지 (?? 가 undefined 일 때만 fallback).
const STARTING_REVERT_POINTS = 10;

function readInitial(raw: unknown): TrainingPersisted {
  const empty: TrainingPersisted = {
    endsAt: null,
    points: 0,
    allocated: { ...ZERO_ALLOCATED },
    revertPoints: STARTING_REVERT_POINTS,
    completedCount: 0,
  };
  if (!raw || typeof raw !== "object") return empty;
  const parsed = raw as {
    endsAt?: number | null;
    points?: number;
    allocated?: Partial<Record<StatKey, number>>;
    revertPoints?: number;
    completedCount?: number;
  };
  return {
    endsAt: parsed.endsAt ?? null,
    // 음수 방어 — 과거 신전 드래프트 버그로 음수가 저장된 세이브 복구.
    points: Math.max(0, parsed.points ?? 0),
    allocated: { ...ZERO_ALLOCATED, ...parsed.allocated },
    revertPoints: Math.max(0, parsed.revertPoints ?? STARTING_REVERT_POINTS),
    completedCount: parsed.completedCount ?? 0,
  };
}

export function useTraining() {
  const initial = useSavedValue("training.v2");
  const initialPersisted = readInitial(initial);

  const [trainingEndsAt, setTrainingEndsAt] = useState<number | null>(
    initialPersisted.endsAt,
  );
  const [unspentPoints, setUnspentPoints] = useState(initialPersisted.points);
  const [allocatedStats, setAllocatedStats] = useState<Record<StatKey, number>>(
    initialPersisted.allocated,
  );
  const [revertPoints, setRevertPoints] = useState(
    initialPersisted.revertPoints,
  );
  const [completedCount, setCompletedCount] = useState(
    initialPersisted.completedCount,
  );
  const [now, setNow] = useState(() => Date.now());

  // 영속 — value 변할 때마다 디바운스 patch.
  const persisted = useMemo(
    () => ({
      endsAt: trainingEndsAt,
      points: unspentPoints,
      allocated: allocatedStats,
      revertPoints,
      completedCount,
    }),
    [
      trainingEndsAt,
      unspentPoints,
      allocatedStats,
      revertPoints,
      completedCount,
    ],
  );
  useRemotePatch("training.v2", persisted);

  // 훈련 진행 중일 때만 1초 단위로 now 갱신.
  useEffect(() => {
    if (!trainingEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [trainingEndsAt]);

  // 훈련 종료 시점 도달 시 자동 적립 (페이지 로드 직후 / 탭 사용 중 모두 처리).
  useEffect(() => {
    if (trainingEndsAt && now >= trainingEndsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnspentPoints((p) => p + 1);
      setCompletedCount((c) => c + 1);
      setTrainingEndsAt(null);
    }
  }, [trainingEndsAt, now]);

  const remaining = trainingEndsAt ? Math.max(0, trainingEndsAt - now) : 0;
  const isTraining = !!trainingEndsAt && remaining > 0;

  // durationMult: 길드 "수련 결사" 버프 — 1.0(없음) ~ 0.85(T5). 훈련 소요시간에 곱한다.
  const startTraining = (durationMult = 1) => {
    if (trainingEndsAt) return;
    const dur = Math.round(TRAINING_DURATION_MS * durationMult);
    setTrainingEndsAt(Date.now() + dur);
    setNow(Date.now());
  };

  // 신전 확정 — 스탯별 delta 묶음을 한 번에 적용. 양수는 단련 포인트 소모,
  // 음수는 되돌리기 포인트 소모 + 단련 포인트 환불. 검증은 호출부(드래프트 UI)에서.
  const commitAllocations = (deltas: Partial<Record<StatKey, number>>) => {
    let unspentDelta = 0;
    let revertSpent = 0;
    for (const k of STAT_KEYS) {
      const d = deltas[k] ?? 0;
      if (d > 0) unspentDelta -= d;
      else if (d < 0) {
        unspentDelta += -d;
        revertSpent += -d;
      }
    }
    if (unspentDelta === 0 && revertSpent === 0) return;
    setAllocatedStats((prev) => {
      const next = { ...prev };
      for (const k of STAT_KEYS) {
        const d = deltas[k] ?? 0;
        if (d !== 0) next[k] = (prev[k] ?? 0) + d;
      }
      return next;
    });
    setUnspentPoints((p) => p + unspentDelta);
    setRevertPoints((r) => r - revertSpent);
  };

  const addPoints = (n: number) => setUnspentPoints((p) => p + n);
  const addRevertPoints = (n: number) => setRevertPoints((r) => r + n);

  return {
    unspentPoints,
    allocatedStats,
    revertPoints,
    completedCount,
    remaining,
    isTraining,
    startTraining,
    commitAllocations,
    addPoints,
    addRevertPoints,
  };
}
