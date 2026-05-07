"use client";

import { Backpack } from "@phosphor-icons/react";
import { ITEMS, type ItemId } from "./data/items";
import { POTIONS, POTION_IDS, type PotionId } from "./data/potions";
import type { InventoryState } from "./inventory/useInventory";
import type {
  AutoPotionConfig,
  AutoPotionRule,
} from "./inventory/useAutoPotionConfig";

export function InventoryView({
  inventory,
  autoConfig,
  onUpdateRule,
  onEquip,
}: {
  inventory: InventoryState;
  autoConfig: AutoPotionConfig;
  onUpdateRule: (index: number, patch: Partial<AutoPotionRule>) => void;
  onEquip?: (id: ItemId) => void;
}) {
  const owned = POTION_IDS.map((id) => ({
    id,
    potion: POTIONS[id],
    count: inventory.potions[id] ?? 0,
  }));
  const totalPotions = owned.reduce((sum, e) => sum + e.count, 0);
  const ownedEquipment = (Object.keys(ITEMS) as ItemId[])
    .map((id) => ({ id, item: ITEMS[id], count: inventory.equipment[id] ?? 0 }))
    .filter((e) => e.count > 0);
  const isEmpty = totalPotions === 0 && ownedEquipment.length === 0;

  return (
    <div className="space-y-3">
      {isEmpty ? (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
          <div className="mx-auto inline-flex text-zinc-400 dark:text-zinc-500">
            <Backpack size={40} weight="duotone" />
          </div>
          <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
            가방이 비어 있습니다
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            상점에서 물약을 사거나, 의뢰·제작으로 장비를 얻어 보세요.
          </div>
        </section>
      ) : (
        <>
          {ownedEquipment.length > 0 && (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                장비
              </div>
              {ownedEquipment.map(({ id, item, count }) => (
                <div
                  key={id}
                  className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.name}
                      {count > 1 && (
                        <span className="ml-1 text-xs font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                          ×{count}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                      {item.stats
                        .map((s) => `${s.label} ${s.value}`)
                        .join(" · ")}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                  )}
                  {onEquip && (
                    <button
                      type="button"
                      onClick={() => onEquip(id)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      장착
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}

          {totalPotions > 0 && (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                물약
              </div>
              {owned
                .filter((e) => e.count > 0)
                .map(({ id, potion, count }) => (
                  <div
                    key={id}
                    className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {potion.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          ×{count}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {potion.description}
                      </p>
                    </div>
                  </div>
                ))}
            </section>
          )}
        </>
      )}

      <AutoPotionSection
        autoConfig={autoConfig}
        inventory={inventory}
        onUpdateRule={onUpdateRule}
      />
    </div>
  );
}

function AutoPotionSection({
  autoConfig,
  inventory,
  onUpdateRule,
}: {
  autoConfig: AutoPotionConfig;
  inventory: InventoryState;
  onUpdateRule: (index: number, patch: Partial<AutoPotionRule>) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          자동 사용 규칙
        </h3>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          자동 전투 중에만 동작
        </span>
      </div>
      <div className="space-y-2">
        {autoConfig.rules.map((rule, i) => (
          <RuleRow
            key={i}
            rule={rule}
            inventory={inventory}
            onChange={(patch) => onUpdateRule(i, patch)}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        ※ 죽기 직전 마지막 한 턴에는 발동하지 못할 수 있어요. 임계값을 충분히 높게 잡아두세요.
      </p>
    </section>
  );
}

const TARGET_LABEL: Record<AutoPotionRule["target"], string> = {
  hp_heal: "HP 회복 물약",
};

function ownedForTarget(
  inventory: InventoryState,
  target: AutoPotionRule["target"],
): number {
  let total = 0;
  for (const id of POTION_IDS) {
    const p = POTIONS[id];
    if (target === "hp_heal" && p.effect.kind !== "heal_hp") continue;
    total += inventory.potions[id] ?? 0;
  }
  return total;
}

function RuleRow({
  rule,
  inventory,
  onChange,
}: {
  rule: AutoPotionRule;
  inventory: InventoryState;
  onChange: (patch: Partial<AutoPotionRule>) => void;
}) {
  const owned = ownedForTarget(inventory, rule.target);
  const pct = rule.trigger.kind === "hp_below_pct" ? rule.trigger.pct : 50;

  const handlePctChange = (next: number) => {
    const clamped = Math.max(1, Math.min(99, Math.round(next)));
    onChange({ trigger: { kind: "hp_below_pct", pct: clamped } });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {TARGET_LABEL[rule.target]}
        </span>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          (보유 {owned})
        </span>
      </label>
      <div className="ml-auto inline-flex items-center gap-1.5">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">HP &lt;</span>
        <input
          type="number"
          min={1}
          max={99}
          value={pct}
          onChange={(e) => handlePctChange(Number(e.target.value))}
          className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
        />
        <span className="text-xs text-zinc-600 dark:text-zinc-400">%</span>
      </div>
    </div>
  );
}
