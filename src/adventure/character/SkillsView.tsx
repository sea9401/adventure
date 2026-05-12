import { Sparkle, Star } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Skill } from "./types";

// 보유 스킬을 슬롯으로 관리. 슬롯에 들어간 스킬만 전투에서 발동.
// 일반 슬롯(normalSlots, 3~4) + 특기 전용 슬롯(featSlotOpen 시 1칸, 특기 1개만).
// onEquip/onUnequip 등 미지정 시 읽기 전용.
export function SkillsView({
  skills,
  equippedNames,
  normalSlots,
  feats,
  equippedFeat,
  featSlotOpen,
  onEquip,
  onUnequip,
  onEquipFeat,
  onUnequipFeat,
}: {
  skills: Skill[];
  equippedNames: string[];
  normalSlots: number;
  feats: Skill[];
  equippedFeat: string | null;
  featSlotOpen: boolean;
  onEquip?: (name: string) => void;
  onUnequip?: (name: string) => void;
  onEquipFeat?: (name: string) => void;
  onUnequipFeat?: () => void;
}) {
  if (skills.length === 0 && feats.length === 0) {
    return (
      <EmptyState
        icon={<Sparkle size={40} weight="duotone" />}
        title="아직 익힌 스킬이 없습니다"
        message="모험을 통해 새로운 스킬을 배워보세요."
      />
    );
  }

  const equippedSet = new Set(equippedNames);
  const unequippedSkills = skills.filter((s) => !equippedSet.has(s.name));
  const slots: (Skill | null)[] = [];
  for (let i = 0; i < normalSlots; i += 1) {
    const name = equippedNames[i];
    slots.push(name ? skills.find((s) => s.name === name) ?? null : null);
  }
  const slotsFull = equippedNames.length >= normalSlots;
  const equippedFeatSkill = equippedFeat
    ? feats.find((f) => f.name === equippedFeat) ?? null
    : null;
  const unequippedFeats = feats.filter((f) => f.name !== equippedFeat);

  return (
    <div className="space-y-3">
      <Card as="section" padding="md">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            장착 슬롯
          </h3>
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {equippedNames.length} / {normalSlots}
            {featSlotOpen && <> · 특기 {equippedFeat ? 1 : 0} / 1</>}
          </span>
        </div>
        <ul className="space-y-2">
          {slots.map((s, i) => (
            <SlotRow
              key={`n${i}`}
              skill={s}
              accent="amber"
              emptyLabel="빈 슬롯"
              onUnequip={s && onUnequip ? () => onUnequip(s.name) : undefined}
            />
          ))}
          {featSlotOpen && (
            <SlotRow
              key="feat"
              skill={equippedFeatSkill}
              accent="violet"
              emptyLabel="특기 슬롯 (빈 칸)"
              icon={
                <Star
                  size={18}
                  weight="duotone"
                  className={`mt-0.5 shrink-0 ${
                    equippedFeatSkill
                      ? "text-violet-500"
                      : "text-zinc-400 dark:text-zinc-600"
                  }`}
                />
              }
              onUnequip={
                equippedFeatSkill && onUnequipFeat ? onUnequipFeat : undefined
              }
            />
          )}
        </ul>
      </Card>

      {unequippedSkills.length > 0 && (
        <Card as="section" padding="md">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            보유 (미장착)
          </h3>
          <ul className="space-y-2">
            {unequippedSkills.map((s) => (
              <ListRow
                key={s.name}
                skill={s}
                actionLabel="장착"
                disabled={slotsFull}
                onAction={onEquip ? () => onEquip(s.name) : undefined}
              />
            ))}
          </ul>
        </Card>
      )}

      {featSlotOpen && unequippedFeats.length > 0 && (
        <Card as="section" padding="md">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            특기 (특기 슬롯 전용 — 1개만 장착)
          </h3>
          <ul className="space-y-2">
            {unequippedFeats.map((f) => (
              <ListRow
                key={f.name}
                skill={f}
                icon={
                  <Star
                    size={18}
                    weight="duotone"
                    className="mt-0.5 shrink-0 text-violet-400 dark:text-violet-500"
                  />
                }
                actionLabel="장착"
                disabled={!!equippedFeat}
                onAction={onEquipFeat ? () => onEquipFeat(f.name) : undefined}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function SlotRow({
  skill,
  accent,
  emptyLabel,
  icon,
  onUnequip,
}: {
  skill: Skill | null;
  accent: "amber" | "violet";
  emptyLabel: string;
  icon?: React.ReactNode;
  onUnequip?: () => void;
}) {
  const filled =
    accent === "violet"
      ? "border-violet-300 bg-violet-50/60 dark:border-violet-800/60 dark:bg-violet-900/10"
      : "border-amber-300 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-900/10";
  return (
    <li
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2 ${
        skill
          ? filled
          : "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
      }`}
    >
      {icon ?? (
        <Sparkle
          size={18}
          weight="duotone"
          className={`mt-0.5 shrink-0 ${
            skill ? "text-amber-500" : "text-zinc-400 dark:text-zinc-600"
          }`}
        />
      )}
      <div className="min-w-0 flex-1">
        {skill ? (
          <>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {skill.name}
            </div>
            {skill.description && (
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {skill.description}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm italic text-zinc-400 dark:text-zinc-600">
            {emptyLabel}
          </div>
        )}
      </div>
      {skill && onUnequip && (
        <button
          type="button"
          onClick={onUnequip}
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          해제
        </button>
      )}
    </li>
  );
}

function ListRow({
  skill,
  icon,
  actionLabel,
  disabled,
  onAction,
}: {
  skill: Skill;
  icon?: React.ReactNode;
  actionLabel: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
      {icon ?? (
        <Sparkle
          size={18}
          weight="duotone"
          className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-600"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {skill.name}
        </div>
        {skill.description && (
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {skill.description}
          </div>
        )}
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {actionLabel}
        </button>
      )}
    </li>
  );
}
