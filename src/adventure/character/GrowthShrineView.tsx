"use client";

import { useState } from "react";
import { Check, Coins, Minus, Plus, X } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { STAT_KEYS, STAT_LABELS, type StatKey } from "@/adventure/data/stats";
import { STAT_ICONS, STAT_ICON_COLORS } from "./statMeta";

const ZERO_DRAFT: Record<StatKey, number> = STAT_KEYS.reduce(
  (acc, k) => {
    acc[k] = 0;
    return acc;
  },
  {} as Record<StatKey, number>,
);

// 되돌리기 포인트 1개 구매 비용 — 캐릭터 레벨 비례. 초반엔 가벼워 빌드 실험 자유,
// 후반엔 부담 늘어 잦은 리셋을 억제. 세 점 (Lv 1=30 / Lv 5=50 / Lv 10=100) 을
// 정확히 지나는 piecewise — 슬로프가 5→10→20 으로 단조 가속.
// 참고: Lv 22≈340G / Lv 30=500G / Lv 50=900G.
export function revertPointPriceFor(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  if (lv <= 5) return 30 + (lv - 1) * 5;     // 30→50  (구간 +5/Lv)
  if (lv <= 10) return 50 + (lv - 5) * 10;   // 50→100 (+10/Lv)
  return 100 + (lv - 10) * 20;               // 100→…  (+20/Lv)
}

// 성장의 신전 — 드래프트 모드. +/- 로 분배안을 미리 짜고, '확정' 으로 일괄 반영.
// 확정 전에는 실제 단련/되돌리기 포인트가 소모되지 않아 실수로 잘못 누른 분배를 되돌릴 수 있다.
export function GrowthShrineView({
  unspentPoints,
  revertPoints,
  allocatedStats,
  baseStats,
  gold,
  level,
  onCommit,
  onBuyRevertPoint,
}: {
  unspentPoints: number;
  revertPoints: number;
  allocatedStats: Record<StatKey, number>;
  baseStats: Record<StatKey, number>;
  gold: number;
  level: number;
  onCommit: (deltas: Record<StatKey, number>) => void;
  onBuyRevertPoint: () => void;
}) {
  const revertPrice = revertPointPriceFor(level);
  const [draft, setDraft] = useState<Record<StatKey, number>>(ZERO_DRAFT);

  const draftPlus = STAT_KEYS.reduce(
    (s, k) => s + Math.max(0, draft[k] ?? 0),
    0,
  );
  const draftMinus = STAT_KEYS.reduce(
    (s, k) => s + Math.max(0, -(draft[k] ?? 0)),
    0,
  );
  // 양수 draft 는 단련 포인트 소모, 음수 draft 는 되돌리기 1 소모 + 단련 1 환불.
  const remainingUnspent = unspentPoints - draftPlus + draftMinus;
  const remainingRevert = revertPoints - draftMinus;
  const hasDraft = draftPlus > 0 || draftMinus > 0;

  const onPlus = (k: StatKey) => {
    const cur = draft[k] ?? 0;
    if (cur < 0) {
      // 되돌리기 취소 — 예산 부담 없음.
      setDraft((prev) => ({ ...prev, [k]: cur + 1 }));
      return;
    }
    if (remainingUnspent <= 0) return;
    setDraft((prev) => ({ ...prev, [k]: cur + 1 }));
  };

  const onMinus = (k: StatKey) => {
    const cur = draft[k] ?? 0;
    if (cur > 0) {
      // 새 분배 취소 — 예산 부담 없음.
      setDraft((prev) => ({ ...prev, [k]: cur - 1 }));
      return;
    }
    const allocated = allocatedStats[k] ?? 0;
    if (allocated + cur <= 0) return;
    if (remainingRevert <= 0) return;
    setDraft((prev) => ({ ...prev, [k]: cur - 1 }));
  };

  const reset = () => setDraft(ZERO_DRAFT);
  const confirm = () => {
    onCommit(draft);
    setDraft(ZERO_DRAFT);
  };

  return (
    <Card as="section" padding="lg">
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          이곳에서 모험으로 얻은 단련을 능력으로 새겨넣을 수 있다. 분배안을
          짜고 <strong>확정</strong> 을 눌러야 적용된다.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <PointBadge
            label="단련 포인트"
            value={remainingUnspent}
            total={unspentPoints}
            tone="emerald"
          />
          <PointBadge
            label="되돌리기 포인트"
            value={remainingRevert}
            total={revertPoints}
            tone="amber"
          />
        </div>

        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
          <Coins
            size={16}
            weight="fill"
            className="shrink-0 text-yellow-500"
          />
          <div className="min-w-0 flex-1 text-xs text-amber-900 dark:text-amber-200">
            되돌리기 포인트 1개를 {revertPrice.toLocaleString()}G 에 살 수 있다.
            <span className="ml-1 text-[10px] text-amber-700/80 dark:text-amber-300/70">
              (Lv 비례)
            </span>
            <span className="ml-2 tabular-nums text-zinc-500 dark:text-zinc-400">
              잔액 {gold.toLocaleString()} G
            </span>
          </div>
          <button
            type="button"
            onClick={onBuyRevertPoint}
            disabled={gold < revertPrice}
            className="shrink-0 rounded-md border border-amber-700 bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +1 구매
          </button>
        </div>

        <div className="space-y-2">
          {STAT_KEYS.map((k) => {
            const Icon = STAT_ICONS[k];
            const allocated = allocatedStats[k] ?? 0;
            const d = draft[k] ?? 0;
            const newAllocated = allocated + d;
            const total = (baseStats[k] ?? 0) + newAllocated;
            const canAdd = d < 0 || remainingUnspent > 0;
            const canSub = d > 0 || (allocated + d > 0 && remainingRevert > 0);
            const ringCls = d > 0
              ? "ring-1 ring-emerald-400/60 dark:ring-emerald-500/40"
              : d < 0
                ? "ring-1 ring-amber-400/60 dark:ring-amber-500/40"
                : "";
            return (
              <div
                key={k}
                className={`flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50 ${ringCls}`}
              >
                <Icon
                  size={22}
                  weight="duotone"
                  className={`shrink-0 ${STAT_ICON_COLORS[k]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {STAT_LABELS[k]}
                  </div>
                  <div className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    합계 {total}
                    {newAllocated > 0 && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                        (+{newAllocated})
                      </span>
                    )}
                    {d !== 0 && (
                      <span
                        className={`ml-2 ${d > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                      >
                        {d > 0 ? `+${d}` : d} 예정
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMinus(k)}
                    disabled={!canSub}
                    aria-label={`${STAT_LABELS[k]} 차감`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Minus size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPlus(k)}
                    disabled={!canAdd}
                    aria-label={`${STAT_LABELS[k]} 단련`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-700 bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={14} weight="bold" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            disabled={!hasDraft}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <X size={14} weight="bold" />
            취소
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!hasDraft}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={14} weight="bold" />
            확정
          </button>
        </div>
      </div>
    </Card>
  );
}

function PointBadge({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "emerald" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  const pending = value !== total;
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${cls}`}>
      <div className="uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">
        {value}
        {pending && (
          <span className="ml-1 text-xs font-normal opacity-60">/ {total}</span>
        )}
      </div>
    </div>
  );
}
