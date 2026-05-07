"use client";

import { Panel } from "@/components/ui/Panel";
import { Tooltip } from "@/components/ui/Tooltip";
import { CLASSES, EQUIPMENT } from "@/lib/game/data";
import { computeStats, getMonumentBonus } from "@/lib/game/logic";
import { useGame } from "@/lib/game/store";
import { getEquipmentNameColor } from "@/lib/equipment-ui";
import type { EquipmentBonus, EquipmentId, EquipmentSlot } from "@/lib/game/types";

const ARMOR_SLOTS: { slot: EquipmentSlot; label: string }[] = [
  { slot: "head", label: "머리" },
  { slot: "body", label: "몸통" },
  { slot: "gloves", label: "장갑" },
  { slot: "boots", label: "신발" },
];

const BONUS_FIELDS: { key: keyof EquipmentBonus; label: string; pct?: boolean }[] = [
  { key: "atk", label: "ATK" },
  { key: "matk", label: "MATK" },
  { key: "def", label: "DEF" },
  { key: "mdef", label: "MDEF" },
  { key: "hp", label: "HP" },
  { key: "spd", label: "SPD" },
  { key: "str", label: "STR" },
  { key: "vit", label: "VIT" },
  { key: "agi", label: "AGI" },
  { key: "int", label: "INT" },
  { key: "crit", label: "CRI", pct: true },
  { key: "dotAmp", label: "DOT", pct: true },
];

function bonusSummary(bonus: EquipmentBonus): string {
  const parts: string[] = [];
  for (const f of BONUS_FIELDS) {
    const v = bonus[f.key];
    if (!v) continue;
    parts.push(f.pct ? `${f.label} +${(v * 100).toFixed(0)}%` : `${f.label} +${v}`);
  }
  return parts.join(" · ");
}

function SlotRow({
  label,
  equippedId,
}: {
  label: string;
  equippedId?: EquipmentId;
}) {
  if (!equippedId) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-fg-faint shrink-0">{label}</span>
        <span className="text-fg-dim italic">없음</span>
      </div>
    );
  }
  const def = EQUIPMENT[equippedId];
  if (!def) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-fg-faint shrink-0">{label}</span>
        <span className="text-fg-dim italic">알 수 없음</span>
      </div>
    );
  }
  const color = getEquipmentNameColor(def);
  const summary = bonusSummary(def.bonus);
  const tooltip = summary ? `${summary}\n${def.flavor}` : def.flavor;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-fg-faint shrink-0">{label}</span>
      <Tooltip content={tooltip} multiline>
        <span className={`truncate text-right ${color || "text-fg"}`}>{def.name}</span>
      </Tooltip>
    </div>
  );
}

function EquipCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-panel-2/40 px-2.5 py-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-fg-faint">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function CharacterSummary() {
  const state = useGame();
  const cls = CLASSES[state.character.currentClass];
  const monBonus = getMonumentBonus(state.estate.monument, state.stats.bossKillCounts);
  const stats = computeStats(state.character, monBonus);
  const hpPct = Math.max(0, Math.min(1, state.character.currentHp / stats.maxHp));
  const equipped = state.character.equipped ?? {};

  return (
    <Panel title="캐릭터">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-base font-semibold text-fg-strong">{state.character.name}</span>
        <span className="text-sm text-fg-faint">{cls.name}</span>
        <span className="text-sm text-fg-dim">Lv.{state.character.level}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-fg-faint shrink-0 w-8">HP</span>
        <div className="flex-1 h-1.5 bg-panel-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${hpPct * 100}%` }}
          />
        </div>
        <span className="text-fg-faint shrink-0 tabular-nums">
          {Math.floor(state.character.currentHp)}/{Math.floor(stats.maxHp)}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-fg-faint">골드</span>
        <span className="text-fg tabular-nums">
          💰 {Math.floor(state.resources.gold).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
        <EquipCard title="무기">
          <SlotRow label="무기" equippedId={equipped.weapon} />
        </EquipCard>
        <EquipCard title="방어구">
          {ARMOR_SLOTS.map(({ slot, label }) => (
            <SlotRow key={slot} label={label} equippedId={equipped[slot]} />
          ))}
        </EquipCard>
        <EquipCard title="장신구">
          <SlotRow label="반지" equippedId={equipped.ring} />
        </EquipCard>
      </div>
    </Panel>
  );
}
