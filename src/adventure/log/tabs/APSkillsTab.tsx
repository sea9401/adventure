"use client";

import { Lightning } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { AP_SKILLS, type APSkill } from "@/adventure/character/apSkills";
import {
  getAPSkillAcquisition,
  type APSkillSource,
} from "@/adventure/character/apSkillSources";
import { WORLD_MAP } from "@/adventure/data/world";
import type { RegionId } from "@/adventure/data/world";

function regionName(id: RegionId): string {
  return WORLD_MAP.regions.find((r) => r.id === id)?.name ?? id;
}

function chanceLabel(chance: number): string {
  return `${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}%`;
}

function SourceLine({ source }: { source: APSkillSource }) {
  switch (source.kind) {
    case "npc_shop":
      return (
        <li className="flex items-baseline justify-between gap-2 py-0.5">
          <span className="text-zinc-600 dark:text-zinc-300">
            <span className="text-amber-600 dark:text-amber-400">NPC 판매</span>{" "}
            · {source.npcName}
          </span>
          <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
            {source.price.toLocaleString()} G
          </span>
        </li>
      );
    case "quest":
      return (
        <li className="flex items-baseline justify-between gap-2 py-0.5">
          <span className="min-w-0 text-zinc-600 dark:text-zinc-300">
            <span className="text-emerald-600 dark:text-emerald-400">
              {source.hidden ? "히든 의뢰" : "의뢰"}
            </span>{" "}
            · {source.questTitle}
            {source.npcName ? ` (${source.npcName})` : ""}
          </span>
          <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
            {regionName(source.regionId)}
          </span>
        </li>
      );
    case "monster_drop":
      return (
        <li className="flex items-baseline justify-between gap-2 py-0.5">
          <span className="text-zinc-600 dark:text-zinc-300">
            <span className="text-rose-600 dark:text-rose-400">드랍</span> ·{" "}
            {source.monsterName}
          </span>
          <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
            {chanceLabel(source.chance)}
          </span>
        </li>
      );
    case "milestone":
      return (
        <li className="py-0.5 text-zinc-600 dark:text-zinc-300">
          <span className="text-violet-600 dark:text-violet-400">업적</span> ·{" "}
          {source.label}
        </li>
      );
  }
}

function APSkillCard({ skill }: { skill: APSkill }) {
  const { book, sources } = getAPSkillAcquisition(skill.id);
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {skill.name}
        </span>
        <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          AP {skill.apCost}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {skill.description}
      </p>
      <div className="mt-2 border-t border-dashed border-zinc-200 pt-1.5 dark:border-zinc-700">
        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          획득 경로
          {book ? (
            <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">
              · {book.name}
            </span>
          ) : null}
        </div>
        {sources.length === 0 ? (
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            기록된 경로가 없습니다.
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-[11px]">
            {sources.map((s, i) => (
              <SourceLine key={i} source={s} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function APSkillsTab({
  learnedAPSkills,
}: {
  learnedAPSkills?: string[];
}) {
  const learned = new Set(learnedAPSkills ?? []);
  const skills = AP_SKILLS.filter((s) => learned.has(s.name));

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<Lightning size={40} weight="duotone" />}
        title="아직 학습한 AP 스킬이 없습니다"
        message="스킬북을 사용해 AP 스킬을 학습하면 여기서 획득 경로를 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-2">
      {skills.map((s) => (
        <APSkillCard key={s.id} skill={s} />
      ))}
    </div>
  );
}
