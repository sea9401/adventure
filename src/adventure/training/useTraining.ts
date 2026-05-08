import { useEffect, useMemo, useState } from "react";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import type { StatKey } from "@/adventure/data/stats";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";

export const TRAINING_DURATION_MS = 6 * 60 * 60 * 1000;

type TrainingPersisted = {
  endsAt: number | null;
  points: number;
  allocated: Record<StatKey, number>;
  // 되돌리기(스탯 차감) 에 필요한 별도 포인트. 첫 시작 시 3개 지급.
  revertPoints: number;
};

// 첫 시작 보너스 — 신규 유저 + 기존 유저(아직 revertPoints 필드 미저장) 모두 3 부여.
// 기존에 0 으로 명시 저장된 유저는 그대로 0 유지 (?? 가 undefined 일 때만 fallback).
const STARTING_REVERT_POINTS = 3;

function readInitial(raw: unknown): TrainingPersisted {
  const empty: TrainingPersisted = {
    endsAt: null,
    points: 0,
    allocated: { ...ZERO_ALLOCATED },
    revertPoints: STARTING_REVERT_POINTS,
  };
  if (!raw || typeof raw !== "object") return empty;
  const parsed = raw as {
    endsAt?: number | null;
    points?: number;
    allocated?: Partial<Record<StatKey, number>>;
    revertPoints?: number;
  };
  return {
    endsAt: parsed.endsAt ?? null,
    points: parsed.points ?? 0,
    allocated: { ...ZERO_ALLOCATED, ...parsed.allocated },
    revertPoints: parsed.revertPoints ?? STARTING_REVERT_POINTS,
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
  const [now, setNow] = useState(() => Date.now());

  // 영속 — value 변할 때마다 디바운스 patch.
  const persisted = useMemo(
    () => ({
      endsAt: trainingEndsAt,
      points: unspentPoints,
      allocated: allocatedStats,
      revertPoints,
    }),
    [trainingEndsAt, unspentPoints, allocatedStats, revertPoints],
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
      setTrainingEndsAt(null);
    }
  }, [trainingEndsAt, now]);

  const remaining = trainingEndsAt ? Math.max(0, trainingEndsAt - now) : 0;
  const isTraining = !!trainingEndsAt && remaining > 0;

  const startTraining = () => {
    if (trainingEndsAt) return;
    setTrainingEndsAt(Date.now() + TRAINING_DURATION_MS);
    setNow(Date.now());
  };

  const allocateStat = (key: StatKey) => {
    if (unspentPoints <= 0) return;
    setAllocatedStats((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    setUnspentPoints((p) => p - 1);
  };

  // 되돌리기 — 되돌리기 포인트 1 소모, 해당 스탯 -1, 단련 포인트 +1.
  const deallocateStat = (key: StatKey) => {
    if (revertPoints <= 0) return;
    if ((allocatedStats[key] ?? 0) <= 0) return;
    setAllocatedStats((prev) => ({
      ...prev,
      [key]: (prev[key] ?? 0) - 1,
    }));
    setUnspentPoints((p) => p + 1);
    setRevertPoints((r) => r - 1);
  };

  const addPoints = (n: number) => setUnspentPoints((p) => p + n);
  const addRevertPoints = (n: number) => setRevertPoints((r) => r + n);

  return {
    unspentPoints,
    allocatedStats,
    revertPoints,
    remaining,
    isTraining,
    startTraining,
    allocateStat,
    deallocateStat,
    addPoints,
    addRevertPoints,
  };
}
