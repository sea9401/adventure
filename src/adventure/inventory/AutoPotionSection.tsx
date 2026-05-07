"use client";

import { POTION_IDS, POTIONS } from "../data/potions";
import type { InventoryState } from "./useInventory";
import type {
  AutoPotionConfig,
  AutoPotionRule,
} from "./useAutoPotionConfig";
import { Card } from "@/components/ui/Card";

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

export function AutoPotionSection({
  autoConfig,
  inventory,
  onUpdateRule,
}: {
  autoConfig: AutoPotionConfig;
  inventory: InventoryState;
  onUpdateRule: (index: number, patch: Partial<AutoPotionRule>) => void;
}) {
  return (
    <Card as="section">
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
    </Card>
  );
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
