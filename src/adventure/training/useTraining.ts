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
};

function readInitial(raw: unknown): TrainingPersisted {
  const empty: TrainingPersisted = {
    endsAt: null,
    points: 0,
    allocated: { ...ZERO_ALLOCATED },
  };
  if (!raw || typeof raw !== "object") return empty;
  const parsed = raw as {
    endsAt?: number | null;
    points?: number;
    allocated?: Partial<Record<StatKey, number>>;
  };
  return {
    endsAt: parsed.endsAt ?? null,
    points: parsed.points ?? 0,
    allocated: { ...ZERO_ALLOCATED, ...parsed.allocated },
  };
}

export function useTraining() {
  const initial = useSavedValue("training.v1");
  const initialPersisted = readInitial(initial);

  const [trainingEndsAt, setTrainingEndsAt] = useState<number | null>(
    initialPersisted.endsAt,
  );
  const [unspentPoints, setUnspentPoints] = useState(initialPersisted.points);
  const [allocatedStats, setAllocatedStats] = useState<Record<StatKey, number>>(
    initialPersisted.allocated,
  );
  const [now, setNow] = useState(() => Date.now());

  // 영속 — value 변할 때마다 디바운스 patch.
  const persisted = useMemo(
    () => ({
      endsAt: trainingEndsAt,
      points: unspentPoints,
      allocated: allocatedStats,
    }),
    [trainingEndsAt, unspentPoints, allocatedStats],
  );
  useRemotePatch("training.v1", persisted);

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

  const addPoints = (n: number) => setUnspentPoints((p) => p + n);

  return {
    unspentPoints,
    allocatedStats,
    remaining,
    isTraining,
    startTraining,
    allocateStat,
    addPoints,
  };
}
