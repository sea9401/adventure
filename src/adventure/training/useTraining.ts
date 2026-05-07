import { useEffect, useState } from "react";
import { TRAINING_STORAGE_KEY } from "@/lib/storage-keys";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import type { StatKey } from "@/adventure/data/stats";

export const TRAINING_DURATION_MS = 4 * 60 * 60 * 1000;

export function useTraining() {
  const [trainingEndsAt, setTrainingEndsAt] = useState<number | null>(null);
  const [unspentPoints, setUnspentPoints] = useState(0);
  const [allocatedStats, setAllocatedStats] =
    useState<Record<StatKey, number>>(ZERO_ALLOCATED);
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRAINING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          endsAt?: number | null;
          points?: number;
          allocated?: Partial<Record<StatKey, number>>;
        };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTrainingEndsAt(parsed.endsAt ?? null);
        setUnspentPoints(parsed.points ?? 0);
        setAllocatedStats({ ...ZERO_ALLOCATED, ...parsed.allocated });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        TRAINING_STORAGE_KEY,
        JSON.stringify({
          endsAt: trainingEndsAt,
          points: unspentPoints,
          allocated: allocatedStats,
        }),
      );
    } catch {}
  }, [hydrated, trainingEndsAt, unspentPoints, allocatedStats]);

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
