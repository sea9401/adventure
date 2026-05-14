"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { AUTO_HUNT_MIN_COLLECT_MS } from "./autoHunt";
import type { AutoHuntHook } from "@/adventure/hunting/useAutoHunt";

function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  // 1시간 이상은 "Xh Ym"(초 생략), 미만은 기존 M:SS 유지 (막바지 초 단위 카운트다운).
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

function dispatchFailMsg(reason: string | undefined): string {
  switch (reason) {
    case "already_active":
      return "이미 자동 사냥 중이다.";
    case "hp_zero":
      return "HP가 0이라 보낼 수 없다.";
    case "no_enemies":
      return "이 지역엔 사냥할 적이 없다.";
    default:
      return "전송에 실패했다 — 다시 시도하세요.";
  }
}

// BattleView pre-screen 의 "자동 사냥 (4시간 원정)" 카드.
// idle → "보내기" / active → 카운트다운 + "지금 받기" / complete → "받기".
// (보상 효율·전투 수 cap 은 내부에만 적용 — UI 에는 표기하지 않는다.)
export function AutoHuntCard({
  autoHunt,
  canDispatch,
}: {
  autoHunt: AutoHuntHook;
  /** HP > 0 && 지역에 적 있음. 아니면 "보내기" disabled. */
  canDispatch: boolean;
}) {
  const { state, remainingMs, durationMs, busy, dispatch, collect } = autoHunt;
  const [err, setErr] = useState<string | null>(null);
  const elapsed = durationMs - remainingMs;
  const canEarlyCollect = elapsed >= AUTO_HUNT_MIN_COLLECT_MS;

  if (state === "idle") {
    return (
      <Card padding="md">
        <div className="text-xs uppercase tracking-wider text-sky-500 dark:text-sky-400">
          자동 사냥 (4시간 원정)
        </div>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          현재 지역으로 캐릭터를 4시간 동안 사냥 보냅니다. 보고 있지 않아도 자동 포션 규칙대로
          진행되며, 4시간 뒤 받기 버튼으로 그동안의 결과를 한 번에 받습니다 (조기 수령 가능).
          위탁 중에는 라이브 사냥·보스 도전·치유소 회복을 할 수 없습니다.
        </p>
        <button
          type="button"
          disabled={!canDispatch || busy}
          onClick={async () => {
            setErr(null);
            const r = await dispatch();
            if (!r.ok) setErr(dispatchFailMsg(r.reason));
          }}
          className="mt-3 w-full rounded-md border border-sky-700 bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "보내는 중..." : "자동 사냥 보내기 — 4시간"}
        </button>
        {err && (
          <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>
        )}
      </Card>
    );
  }

  const done = state === "complete";
  return (
    <Card padding="md">
      <div className="text-xs uppercase tracking-wider text-sky-500 dark:text-sky-400">
        자동 사냥
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {done ? "원정 완료!" : "원정 진행 중"}
          </div>
          <div className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {done ? "수령 대기" : `완료까지 ${fmtRemain(remainingMs)}`}
          </div>
        </div>
        <button
          type="button"
          disabled={busy || (!done && !canEarlyCollect)}
          onClick={() => collect()}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            done
              ? "border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700"
              : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          {busy ? "받는 중..." : done ? "받기" : "지금 받기"}
        </button>
      </div>
      {!done && (
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          위탁 중 — 라이브 사냥·보스 도전·치유소 회복 불가. 지금 받기는 그때까지 진행된 만큼만 챙기고 종료.
        </p>
      )}
    </Card>
  );
}
