import { Sparkle } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SKILL_SLOT_COUNT } from "./skills";
import type { Skill } from "./types";

// 보유 스킬을 슬롯(SKILL_SLOT_COUNT)으로 관리. 슬롯에 들어간 스킬만 전투에서 발동.
// onEquip/onUnequip 미지정 시 읽기 전용 — 외부 wiring 안 됐을 때 폴백.
export function SkillsView({
  skills,
  equippedNames,
  onEquip,
  onUnequip,
}: {
  skills: Skill[];
  equippedNames: string[];
  onEquip?: (name: string) => void;
  onUnequip?: (name: string) => void;
}) {
  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<Sparkle size={40} weight="duotone" />}
        title="아직 익힌 스킬이 없습니다"
        message="모험을 통해 새로운 스킬을 배워보세요."
      />
    );
  }

  const equippedSet = new Set(equippedNames);
  const unequipped = skills.filter((s) => !equippedSet.has(s.name));
  const slots: (Skill | null)[] = [];
  for (let i = 0; i < SKILL_SLOT_COUNT; i += 1) {
    const name = equippedNames[i];
    slots.push(name ? skills.find((s) => s.name === name) ?? null : null);
  }
  const slotsFull = equippedNames.length >= SKILL_SLOT_COUNT;

  return (
    <div className="space-y-3">
      <Card as="section" padding="md">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            장착 슬롯
          </h3>
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {equippedNames.length} / {SKILL_SLOT_COUNT}
          </span>
        </div>
        <ul className="space-y-2">
          {slots.map((s, i) => (
            <li
              key={i}
              className={`flex items-start gap-2.5 rounded-md border px-3 py-2 ${
                s
                  ? "border-amber-300 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-900/10"
                  : "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
              }`}
            >
              <Sparkle
                size={18}
                weight="duotone"
                className={`mt-0.5 shrink-0 ${
                  s ? "text-amber-500" : "text-zinc-400 dark:text-zinc-600"
                }`}
              />
              <div className="min-w-0 flex-1">
                {s ? (
                  <>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {s.name}
                    </div>
                    {s.description && (
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {s.description}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm italic text-zinc-400 dark:text-zinc-600">
                    빈 슬롯
                  </div>
                )}
              </div>
              {s && onUnequip && (
                <button
                  type="button"
                  onClick={() => onUnequip(s.name)}
                  className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  해제
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {unequipped.length > 0 && (
        <Card as="section" padding="md">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            보유 (미장착)
          </h3>
          <ul className="space-y-2">
            {unequipped.map((s) => (
              <li
                key={s.name}
                className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <Sparkle
                  size={18}
                  weight="duotone"
                  className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {s.name}
                  </div>
                  {s.description && (
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {s.description}
                    </div>
                  )}
                </div>
                {onEquip && (
                  <button
                    type="button"
                    onClick={() => onEquip(s.name)}
                    disabled={slotsFull}
                    className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    장착
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
