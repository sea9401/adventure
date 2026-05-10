"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../AdminContext";
import { Button } from "../ui/Field";
import { COOP_BOSSES } from "@/adventure/coop/data";

type AdminSession = {
  id: string;
  regionId: string;
  bossName: string;
  hp: number;
  maxHp: number;
  spawnedAt: string;
  expiresAt: string;
  defeatedAt: string | null;
  nextSpawnAt: string | null;
  contributorCount: number;
  totalDamage: number;
};

const REGION_OPTIONS = Object.keys(COOP_BOSSES);

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  if (Math.abs(diff) < 60_000) return "방금";
  if (diff > 0) {
    if (diff < 3_600_000) return `+${Math.floor(diff / 60_000)}분`;
    if (diff < 86_400_000) return `+${Math.floor(diff / 3_600_000)}시간`;
    return new Date(iso).toLocaleString("ko-KR");
  } else {
    const back = -diff;
    if (back < 3_600_000) return `${Math.floor(back / 60_000)}분 전`;
    if (back < 86_400_000) return `${Math.floor(back / 3_600_000)}시간 전`;
    return new Date(iso).toLocaleString("ko-KR");
  }
}

export function CoopTab() {
  const { readOnly, showToast } = useAdmin();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState(REGION_OPTIONS[0] ?? "");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/coop");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { sessions: AdminSession[] };
      setSessions(data.sessions);
    } catch (e) {
      showToast(`조회 실패: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const post = async (action: string, extra: Record<string, unknown> = {}) => {
    if (readOnly) {
      showToast("보기 전용 모드 — 변경 불가");
      return;
    }
    try {
      const r = await fetch("/api/admin/coop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, region, ...extra }),
      });
      const txt = await r.text();
      if (!r.ok) {
        showToast(`${action} 실패: ${txt}`);
        return;
      }
      showToast(`${action} 완료`);
      await refresh();
    } catch (e) {
      showToast(`${action} 실패: ${e instanceof Error ? e.message : "unknown"}`);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">협동 보스 — 강제 액션</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <span className="text-zinc-600 dark:text-zinc-400">region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r} ({COOP_BOSSES[r as keyof typeof COOP_BOSSES]?.monsterName})
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => void post("spawn")}>새 spawn</Button>
          <Button onClick={() => void post("spawn", { force: true })}>강제 spawn (기존 종료)</Button>
          <Button onClick={() => void post("end")}>현재 활성 종료</Button>
          <Button onClick={() => void post("set_hp", { hp: 100 })}>hp = 100</Button>
          <Button onClick={() => void post("set_hp", { hp: 1 })}>hp = 1 (처치 직전)</Button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          spawn 은 해당 region 에 활성 세션이 없을 때만 동작 (force=true 면 기존 종료 후 새로 만듦).
        </p>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">최근 세션 (최대 20)</h3>
          <Button onClick={() => void refresh()} disabled={loading}>
            {loading ? "조회 중…" : "새로고침"}
          </Button>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-2 py-1">region</th>
                <th className="px-2 py-1">보스</th>
                <th className="px-2 py-1">상태</th>
                <th className="px-2 py-1 text-right">HP</th>
                <th className="px-2 py-1 text-right">기여자/누적 dmg</th>
                <th className="px-2 py-1">spawned</th>
                <th className="px-2 py-1">expires</th>
                <th className="px-2 py-1">defeated</th>
                <th className="px-2 py-1">nextSpawn</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-2 text-center text-zinc-500">
                    세션 없음
                  </td>
                </tr>
              )}
              {sessions.map((s) => {
                const status = s.defeatedAt
                  ? "처치/만료됨"
                  : new Date(s.expiresAt) < new Date()
                    ? "만료 (정리 대기)"
                    : "활성";
                return (
                  <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1">{s.regionId}</td>
                    <td className="px-2 py-1">{s.bossName}</td>
                    <td className="px-2 py-1">{status}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {s.hp.toLocaleString()} / {s.maxHp.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {s.contributorCount} · {s.totalDamage.toLocaleString()}
                    </td>
                    <td className="px-2 py-1">{formatTime(s.spawnedAt)}</td>
                    <td className="px-2 py-1">{formatTime(s.expiresAt)}</td>
                    <td className="px-2 py-1">{formatTime(s.defeatedAt)}</td>
                    <td className="px-2 py-1">{formatTime(s.nextSpawnAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
