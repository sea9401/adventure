"use client";

// 별빛 강화소 — 별빛 재단 무구 인스턴스를 +1~+5 까지 누진 비용으로 강화.
// 대장간 옆 sub-view 로 진입. 강화 가능한 인스턴스를 한 자루씩 카드로 보여 주고,
// 다음 단계 비용 + "강화" 버튼 + 보유 별빛 조각 부족 시 disable.
//
// 강화 자체는 서버 권위(/api/enhance) — useEnhanceAction.handleEnhance 호출.

import { Sparkle } from "@phosphor-icons/react";
import { ITEMS } from "@/adventure/data/items";
import { craftTierSuffix } from "@/adventure/data/craftQuality";
import {
  ENHANCE_MAX_LEVEL,
  ENHANCE_SHARD_COST,
  enhancementBonus,
  resolveEnhancedItem,
} from "@/adventure/character/enhancement";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EquipmentInstance } from "@/adventure/inventory/equipmentInstances";

type Props = {
  instances: readonly EquipmentInstance[];
  shardCount: number;
  onEnhance: (instanceId: string) => void;
};

// 한 단계 강화 시 atk/주능력치 가 +1 (무기) 또는 dex/spd 가 +1 (망토). 미리보기에 쓴다.
function nextLevelDeltaSummary(itemId: EquipmentInstance["itemId"]): string {
  const per = enhancementBonus(itemId, 1);
  const parts: string[] = [];
  if (per.atk) parts.push(`공격력 +${per.atk}`);
  if (per.str) parts.push(`힘 +${per.str}`);
  if (per.vit) parts.push(`활력 +${per.vit}`);
  if (per.dex) parts.push(`민첩 +${per.dex}`);
  if (per.luk) parts.push(`행운 +${per.luk}`);
  if (per.spd) parts.push(`속도 +${per.spd}`);
  return parts.join(" · ");
}

export function EnhancementPanel({ instances, shardCount, onEnhance }: Props) {
  if (instances.length === 0) {
    return (
      <EmptyState
        icon={<Sparkle size={40} weight="duotone" />}
        title="강화할 장비가 없습니다"
        message="별빛 재단 무구를 먼저 만들어 가져오세요."
      />
    );
  }
  return (
    <div className="space-y-3">
      <Card as="section" padding="md">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            별빛 강화
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            보유 별빛 조각{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {shardCount}
            </span>
          </p>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          잔영 셋을 잠재운 결을 한 점 한 점 무구에 옮기는 자리. 강화 단계마다 별빛 조각이 누진적으로 들어간다. 최대 +{ENHANCE_MAX_LEVEL}.
        </p>
      </Card>

      <ul className="space-y-2">
        {instances.map((inst) => {
          const base = ITEMS[inst.itemId];
          const item = resolveEnhancedItem(
            inst.itemId,
            inst.craftTier,
            inst.enhancementLevel,
            inst.instanceId,
          );
          const isMax = inst.enhancementLevel >= ENHANCE_MAX_LEVEL;
          const nextLevel = inst.enhancementLevel + 1;
          const nextCost = isMax ? 0 : ENHANCE_SHARD_COST[nextLevel] ?? 0;
          const canAfford = shardCount >= nextCost;
          const tierSuf = craftTierSuffix(inst.craftTier).trim();
          const enhSuf =
            inst.enhancementLevel > 0 ? `+${inst.enhancementLevel}` : "";
          const deltaSummary = isMax ? "" : nextLevelDeltaSummary(inst.itemId);
          return (
            <li
              key={inst.instanceId}
              className="rounded-md border border-zinc-200 bg-white/90 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/90"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {base.name}
                    </span>
                    {tierSuf && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {tierSuf}
                      </span>
                    )}
                    {enhSuf && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {enhSuf}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    {item.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
                  </div>
                  {!isMax && (
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      +{nextLevel} 강화 시: {deltaSummary} (별빛 조각 {nextCost})
                    </div>
                  )}
                </div>
                <div className="shrink-0 pt-0.5">
                  {isMax ? (
                    <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      풀강 +{ENHANCE_MAX_LEVEL}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEnhance(inst.instanceId)}
                      disabled={!canAfford}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
                    >
                      +{nextLevel} 강화 ({nextCost})
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
