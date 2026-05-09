"use client";

import { Card } from "@/components/ui/Card";
import { MONSTERS } from "../data/monsters";
import { POTIONS, type PotionId } from "../data/potions";
import { MATERIALS, type MaterialId } from "../data/materials";
import { ITEMS, type ItemId } from "../data/items";
import { getRecipeById } from "../data/recipes";
import { OFFLINE_SIM_MAX_MS, type OfflineSimResult } from "./offlineSim";
import { useEscapeKey } from "@/lib/useEscapeKey";

// 자동 사냥 켜둔 채 탭/앱을 떠난 동안 누적된 보상을 한 화면에 보여준다.
// 알림(noti)은 작아서 놓치기 쉬워, 복귀 직후 모달로 가시화.
export function OfflineRewardsModal({
  result,
  onClose,
}: {
  result: OfflineSimResult;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  const minutes = Math.max(1, Math.round(result.simulatedMs / 60_000));
  const capLabel = result.cappedByLimit
    ? `${OFFLINE_SIM_MAX_MS / 60_000}분 cap`
    : null;

  const kills = Object.entries(result.killsByName)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  const materials = Object.entries(result.materialsGained).filter(
    ([, n]) => (n ?? 0) > 0,
  );

  // 같은 장비가 여러 개 드랍될 수 있어 카운트로 합침.
  const equipCounts = new Map<ItemId, number>();
  for (const id of result.equipsGained) {
    equipCounts.set(id, (equipCounts.get(id) ?? 0) + 1);
  }

  const potions = Object.entries(result.potionsConsumed).filter(
    ([, n]) => (n ?? 0) > 0,
  );

  const hasAnyDrop =
    result.goldGained > 0 ||
    materials.length > 0 ||
    equipCounts.size > 0 ||
    result.recipesLearned.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-rewards-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <Card padding="lg" className="w-full max-w-sm">
        <div className="text-center">
          <div
            id="offline-rewards-title"
            className="text-xl font-semibold text-emerald-600 dark:text-emerald-400"
          >
            오프라인 사냥 보상
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {minutes}분 동안 자동 사냥{capLabel ? ` · ${capLabel}` : ""}
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {kills.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  처치
                </span>
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  총 {result.wins}
                </span>
              </div>
              <ul className="space-y-1.5">
                {kills.map(([name, n]) => {
                  const monster = MONSTERS[name];
                  return (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {monster?.image ? (
                          <span className="size-7 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={monster.image}
                              alt={name}
                              className="h-full w-full object-cover"
                            />
                          </span>
                        ) : (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-100 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                            ?
                          </span>
                        )}
                        <span className="truncate text-zinc-700 dark:text-zinc-200">
                          {name}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                        ×{n}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(result.expGained > 0 || result.goldGained > 0) && (
            <div className="space-y-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              {result.expGained > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    EXP
                    {result.expBonusApplied && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                        (신참 ×2)
                      </span>
                    )}
                  </span>
                  <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{result.expGained}
                  </span>
                </div>
              )}
              {result.goldGained > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">골드</span>
                  <span className="font-medium tabular-nums text-yellow-600 dark:text-yellow-400">
                    +{result.goldGained}
                  </span>
                </div>
              )}
            </div>
          )}

          {hasAnyDrop &&
            (materials.length > 0 ||
              equipCounts.size > 0 ||
              result.recipesLearned.length > 0) && (
              <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <div className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  획득 아이템
                </div>
                <ul className="space-y-1">
                  {materials.map(([id, n]) => {
                    const mat = MATERIALS[id as MaterialId];
                    return (
                      <li
                        key={`mat-${id}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-zinc-700 dark:text-zinc-200">
                          {mat?.name ?? id}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                          ×{n}
                        </span>
                      </li>
                    );
                  })}
                  {Array.from(equipCounts.entries()).map(([id, n]) => {
                    const item = ITEMS[id];
                    return (
                      <li
                        key={`eq-${id}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-amber-700 dark:text-amber-300">
                          {item?.name ?? id}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                          ×{n}
                        </span>
                      </li>
                    );
                  })}
                  {result.recipesLearned.map((id) => {
                    const recipe = getRecipeById(id);
                    return (
                      <li
                        key={`rcp-${id}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-sky-700 dark:text-sky-300">
                          제작서 · {recipe?.name ?? id}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                          학습
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

          {potions.length > 0 && (
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <div className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                소비 포션
              </div>
              <ul className="space-y-1">
                {potions.map(([id, n]) => {
                  const potion = POTIONS[id as PotionId];
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-zinc-700 dark:text-zinc-200">
                        {potion?.name ?? id}
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                        ×{n}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {result.died && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-2.5 text-center text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              사망 — 복귀 마을로 옮겨졌다. 치유소에서 회복이 필요하다.
            </div>
          )}

          {kills.length === 0 &&
            result.expGained === 0 &&
            !hasAnyDrop &&
            !result.died && (
              <div className="text-center text-zinc-500 dark:text-zinc-400">
                아무 일도 일어나지 않았다.
              </div>
            )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          확인
        </button>
      </Card>
    </div>
  );
}
