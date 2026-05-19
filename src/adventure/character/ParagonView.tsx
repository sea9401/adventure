"use client";

import { useState } from "react";
import {
  ArrowsClockwise,
  Check,
  Coins,
  Crown,
  Crosshair,
  Flame,
  Heart,
  Lightning,
  Minus,
  Plus,
  Shield,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import {
  cumulativeExpForPoints,
  expToNextPoint,
  PARAGON_TOTAL_CAP,
  PARAGON_TRACK_CAP,
  PARAGON_TRACK_EFFECTS,
  PARAGON_TRACK_LABELS,
  PARAGON_TRACKS,
  pointsFromExp,
  type ParagonState,
  type ParagonTrackKey,
} from "@/lib/paragon";

export const PARAGON_RESPEC_SHARD_COST = 10;

// 트랙 아이콘 + 색. 룬 화면(Diamond) 과 차별되도록 트랙별로 다른 시각 단서를 주되,
// 동일 카테고리(공격 계열 = rose/orange) 는 톤을 모은다.
const TRACK_ICONS: Record<
  ParagonTrackKey,
  { Icon: typeof Crown; color: string }
> = {
  wrath: { Icon: Flame, color: "text-rose-500" },
  guard: { Icon: Shield, color: "text-sky-500" },
  vigor: { Icon: Heart, color: "text-emerald-500" },
  precision: { Icon: Crosshair, color: "text-amber-500" },
  blast: { Icon: Lightning, color: "text-orange-500" },
  fortune: { Icon: Coins, color: "text-yellow-500" },
};

// 트랙 효과 설명 — perPoint 와 PARAGON_TRACK_EFFECTS 의 kind 를 사람이 읽기 좋게.
function describeTrackEffect(track: ParagonTrackKey, points: number): string {
  const eff = PARAGON_TRACK_EFFECTS[track];
  const total = eff.perPoint * points;
  const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
  switch (eff.kind) {
    case "flatAtk":
      return `ATK +${fmt(total)}`;
    case "flatDef":
      return `DEF +${fmt(total)}`;
    case "pctMaxHp":
      return `최대 HP +${fmt(total)}%`;
    case "ppCritRate":
      return `치명타율 +${fmt(total)}%p`;
    case "ppCritDmg":
      return `치명타 데미지 +${fmt(total)}%p`;
    case "pctGoldExp":
      return `골드·EXP 획득 +${fmt(total)}%`;
  }
}

function describeTrackPerPoint(track: ParagonTrackKey): string {
  return describeTrackEffect(track, 1) + " / pt";
}

export function ParagonView({
  state,
  shardCount,
  onCommit,
  onRespec,
}: {
  state: ParagonState;
  shardCount: number;
  /**
   * draft 를 확정. 보유 포인트 초과 등으로 거절되면 false 반환 (호출 측에서 토스트).
   */
  onCommit: (next: Partial<Record<ParagonTrackKey, number>>) => boolean;
  /**
   * 별빛 조각 PARAGON_RESPEC_SHARD_COST 소비하고 allocations 비움. 자원 부족 시 false.
   */
  onRespec: () => boolean;
}) {
  const totalPoints = pointsFromExp(state.paragonExp);
  const committed = state.allocations;

  // draft = 사용자가 확정 전 만지작거리는 분배안. 초기값 = 현재 확정 상태.
  const [draft, setDraft] = useState<Partial<Record<ParagonTrackKey, number>>>(
    () => ({ ...committed }),
  );

  const draftTotal = PARAGON_TRACKS.reduce(
    (s, k) => s + (draft[k] ?? 0),
    0,
  );
  const remaining = totalPoints - draftTotal;
  const hasDiff = PARAGON_TRACKS.some(
    (k) => (draft[k] ?? 0) !== (committed[k] ?? 0),
  );

  const setTrack = (track: ParagonTrackKey, delta: number) => {
    setDraft((prev) => {
      const cur = prev[track] ?? 0;
      // 하한 = 이미 확정된 값. 부분 환원 = 자유 리스펙 회피.
      // 더 줄이고 싶으면 별빛 조각으로 전체 리스펙.
      const floor = committed[track] ?? 0;
      const want = Math.max(
        floor,
        Math.min(PARAGON_TRACK_CAP, cur + delta),
      );
      // 잔여 포인트 한계로 클램프 (+ 일 때만 의미 있음).
      const allocated = PARAGON_TRACKS.reduce(
        (s, k) => s + (k === track ? 0 : prev[k] ?? 0),
        0,
      );
      const capByRemaining = Math.max(floor, totalPoints - allocated);
      const next = Math.min(want, capByRemaining);
      if (next === cur) return prev;
      const out = { ...prev };
      if (next <= 0) delete out[track];
      else out[track] = next;
      return out;
    });
  };

  const cancel = () => setDraft({ ...committed });
  const confirm = () => {
    if (!hasDiff) return;
    const ok = onCommit(draft);
    if (ok) setDraft({ ...draft }); // 확정된 값이 committed 와 같아지므로 hasDiff=false 가 됨
  };

  // 다음 포인트까지 진행도 (캡 상태면 0/0).
  const toNext = expToNextPoint(state.paragonExp);
  const isCapped = totalPoints >= PARAGON_TOTAL_CAP;
  // 진행 바 계산 — "현재 pt 보유 누적 EXP" 대비 "다음 pt 까지 추가 필요 EXP" 비율.
  const expAtCurrentPt = cumulativeExpForPoints(totalPoints);
  const progress = isCapped
    ? 1
    : Math.max(
        0,
        Math.min(
          1,
          (state.paragonExp - expAtCurrentPt) /
            Math.max(1, cumulativeExpForPoints(totalPoints + 1) - expAtCurrentPt),
        ),
      );

  const canRespec =
    Object.keys(committed).length > 0 && shardCount >= PARAGON_RESPEC_SHARD_COST;

  return (
    <Card as="section" padding="lg">
      <div className="space-y-4">
        {/* 헤더 — 파라곤 레벨 / 보유 포인트 / 다음 pt 까지 진행도 */}
        <div className="rounded-md border border-violet-300 bg-violet-50 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/40">
          <div className="flex items-center gap-2">
            <Crown size={20} weight="duotone" className="text-violet-500" />
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-violet-700 dark:text-violet-300">
                파라곤 레벨
              </div>
              <div className="text-lg font-semibold tabular-nums text-violet-900 dark:text-violet-100">
                {totalPoints}
                <span className="ml-1 text-xs font-normal opacity-60">
                  / {PARAGON_TOTAL_CAP}
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-violet-800 dark:text-violet-200">
              <div>잔여 포인트</div>
              <div className="text-base font-semibold tabular-nums">
                {remaining}
              </div>
            </div>
          </div>
          {!isCapped ? (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-violet-200 dark:bg-violet-900/60">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${(progress * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] tabular-nums text-violet-700/80 dark:text-violet-300/80">
                다음 포인트까지 EXP {toNext.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">
              모든 파라곤 포인트를 획득했다 (졸업).
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          만렙 도달 후 적립되는 EXP 로 6트랙에 포인트를 분배한다. 트랙당 최대{" "}
          {PARAGON_TRACK_CAP}pt. <strong>확정</strong> 을 눌러야 적용된다.
        </p>

        {/* 6 트랙 */}
        <div className="space-y-2">
          {PARAGON_TRACKS.map((k) => {
            const { Icon, color } = TRACK_ICONS[k];
            const cur = draft[k] ?? 0;
            const commit = committed[k] ?? 0;
            const trackFull = cur >= PARAGON_TRACK_CAP;
            const canAdd = !trackFull && remaining > 0;
            // 확정값(committed) 미만으로는 -할 수 없음 — 더 줄이려면 별빛 조각 리스펙.
            const canSub = cur > commit;
            const changed = cur !== commit;
            const ringCls = changed
              ? cur > commit
                ? "ring-1 ring-emerald-400/60 dark:ring-emerald-500/40"
                : "ring-1 ring-amber-400/60 dark:ring-amber-500/40"
              : "";
            return (
              <div
                key={k}
                className={`rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50 ${ringCls}`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={22}
                    weight="duotone"
                    className={`shrink-0 ${color}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {PARAGON_TRACK_LABELS[k]}
                      <span className="ml-2 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                        {describeTrackPerPoint(k)}
                      </span>
                    </div>
                    <div className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                        {cur}
                      </span>
                      <span className="opacity-60"> / {PARAGON_TRACK_CAP}</span>
                      {cur > 0 && (
                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                          → {describeTrackEffect(k, cur)}
                        </span>
                      )}
                      {changed && (
                        <span
                          className={`ml-2 ${cur > commit ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                        >
                          ({cur > commit ? "+" : ""}
                          {cur - commit} 예정)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTrack(k, -1)}
                      disabled={!canSub}
                      aria-label={`${PARAGON_TRACK_LABELS[k]} -1`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Minus size={14} weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrack(k, 1)}
                      disabled={!canAdd}
                      aria-label={`${PARAGON_TRACK_LABELS[k]} +1`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-emerald-700 bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 확정/취소 */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={cancel}
            disabled={!hasDiff}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <X size={14} weight="bold" />
            취소
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!hasDiff}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={14} weight="bold" />
            확정
          </button>
        </div>

        {/* 리스펙 */}
        <div className="flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2 dark:border-violet-900/60 dark:bg-violet-950/30">
          <Sparkle size={16} weight="duotone" className="shrink-0 text-violet-500" />
          <div className="min-w-0 flex-1 text-xs text-violet-900 dark:text-violet-200">
            별빛 조각 ×{PARAGON_RESPEC_SHARD_COST} 로 모든 분배를 되돌린다.
            <span className="ml-2 tabular-nums text-zinc-500 dark:text-zinc-400">
              보유 {shardCount}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const ok = onRespec();
              if (ok) setDraft({});
            }}
            disabled={!canRespec}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-violet-700 bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowsClockwise size={14} weight="bold" />
            초기화
          </button>
        </div>
      </div>
    </Card>
  );
}
