"use client";

import { useMemo, useState } from "react";
import {
  ArrowsDownUp,
  CaretDown,
  CaretRight,
  Crown,
  Lock,
} from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import {
  COUNTER_TITLES,
  TITLES,
  type TitleId,
} from "@/adventure/data/titles";
import type { AdventureLog } from "@/adventure/log/storage";
import type { TitleCounterValues } from "./shared";

// 도감에는 정의된 모든 칭호를 잠금/획득 상태로 표시 — 그 중 획득(log.titles 등록)된
// 칭호만 장착/해제 가능. 한 번에 한 개만 장착 (equippedTitleId).
export function TitlesTab({
  log,
  equippedTitleId,
  onEquipTitle,
  titleCounters,
}: {
  log: AdventureLog;
  equippedTitleId: string | null;
  onEquipTitle?: (titleId: TitleId | null) => void;
  titleCounters: TitleCounterValues;
}) {
  const [lockedOpen, setLockedOpen] = useState(false);
  // 획득 칭호 정렬 — 클릭 시 토글. 기본값 recent (가장 최근 획득 위).
  const [sortMode, setSortMode] = useState<"recent" | "abc">("recent");
  const obtained = useMemo(() => {
    const arr = Object.values(TITLES).filter((t) => !!log.titles[t.id]);
    if (sortMode === "abc") {
      arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else {
      // recent — obtainedAt 내림차순. 동률은 정의 순서 안정 유지.
      arr.sort(
        (a, b) =>
          (log.titles[b.id]?.obtainedAt ?? 0) -
          (log.titles[a.id]?.obtainedAt ?? 0),
      );
    }
    return arr;
  }, [sortMode, log.titles]);
  const all = Object.values(TITLES);
  if (all.length === 0) {
    return (
      <EmptyState
        icon={<Crown size={40} weight="duotone" />}
        title="아직 정의된 칭호가 없습니다"
        message="추후 업데이트로 추가될 예정입니다."
      />
    );
  }
  const locked = all.filter((t) => !log.titles[t.id]);

  const renderCard = (title: (typeof all)[number]) => {
    const entry = log.titles[title.id];
    const isObtained = !!entry;
    const isEquipped = equippedTitleId === title.id;
    // 카운터형 칭호: 미획득 상태에서도 절반 도달 시 조건만 미리 공개.
    const counter = COUNTER_TITLES.find((c) => c.id === title.id);
    const counterValue = counter ? (titleCounters[counter.key] ?? 0) : 0;
    const conditionRevealed =
      !isObtained && !!counter && counterValue >= counter.target / 2;
    return (
      <Card key={title.id}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isObtained ? (
              title.name
            ) : (
              <span className="flex items-center gap-1 italic text-zinc-400 dark:text-zinc-500">
                <Lock size={12} weight="duotone" />
                ???
              </span>
            )}
            {isEquipped && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                장착중
              </span>
            )}
          </span>
          {isObtained && entry && (
            <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {new Date(entry.obtainedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {isObtained ? (
            title.description
          ) : conditionRevealed ? (
            <span className="text-zinc-500 dark:text-zinc-400">
              달성 조건 — {title.condition} ({counterValue}/{counter!.target})
            </span>
          ) : (
            <span className="italic text-zinc-400 dark:text-zinc-500">
              달성 조건 ???
            </span>
          )}
        </p>
        {isObtained && onEquipTitle && (
          <button
            type="button"
            onClick={() =>
              onEquipTitle(isEquipped ? null : (title.id as TitleId))
            }
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isEquipped ? "해제" : "장착"}
          </button>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            획득한 칭호 ({obtained.length})
          </h3>
          {obtained.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setSortMode((m) => (m === "recent" ? "abc" : "recent"))
              }
              aria-label={
                sortMode === "recent" ? "ABC 순으로 정렬" : "최근 획득순으로 정렬"
              }
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ArrowsDownUp size={11} weight="bold" />
              {sortMode === "recent" ? "최근 획득순" : "ABC 순"}
            </button>
          )}
        </div>
        {obtained.length === 0 ? (
          <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
            아직 획득한 칭호가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">{obtained.map(renderCard)}</div>
        )}
      </section>

      {locked.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setLockedOpen((v) => !v)}
            aria-expanded={lockedOpen}
            className="mb-2 flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {lockedOpen ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            미획득 칭호 ({locked.length})
          </button>
          {lockedOpen && (
            <div className="space-y-2">{locked.map(renderCard)}</div>
          )}
        </section>
      )}
    </div>
  );
}
