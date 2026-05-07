import { Sparkle } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Skill } from "./types";

export function SkillsView({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<Sparkle size={40} weight="duotone" />}
        title="아직 익힌 스킬이 없습니다"
        message="모험을 통해 새로운 스킬을 배워보세요."
      />
    );
  }
  return (
    <Card as="section" padding="md">
      <ul className="space-y-2">
        {skills.map((s) => (
          <li
            key={s.name}
            className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <Sparkle
              size={18}
              weight="duotone"
              className="mt-0.5 shrink-0 text-amber-500"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {s.name}
              </div>
              {s.description && (
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {s.description}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
