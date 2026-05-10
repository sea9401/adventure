"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Sparkle, Scroll } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  acceptGuildQuest,
  fetchThisWeekGuildQuests,
  GuildError,
  type GuildQuestInstanceShape,
  type GuildQuestsThisWeekResponse,
} from "./api";
import {
  getGuildQuestById,
  type GuildQuestDef,
} from "@/adventure/data/guildQuests";
import { MATERIALS } from "@/adventure/data/materials";
import { ITEMS } from "@/adventure/data/items";

const GRADE_COLOR: Record<string, string> = {
  G: "text-zinc-500 dark:text-zinc-400",
  F: "text-zinc-600 dark:text-zinc-300",
  E: "text-emerald-600 dark:text-emerald-400",
  D: "text-sky-600 dark:text-sky-400",
  C: "text-blue-600 dark:text-blue-400",
  B: "text-violet-600 dark:text-violet-400",
  A: "text-amber-600 dark:text-amber-400",
  S: "text-rose-600 dark:text-rose-400",
};

export function GuildQuestsPanel({
  onUpdated,
}: {
  // 의뢰 수락 후 상위 길드 정보(명성 변경 가능성 있음)도 갱신할 수 있게 옵션 콜백.
  onUpdated?: () => void;
}) {
  const [data, setData] = useState<GuildQuestsThisWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchThisWeekGuildQuests();
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleAccept = async (instanceId: number) => {
    setBusy(true);
    setError(null);
    try {
      await acceptGuildQuest(instanceId);
      await load();
      onUpdated?.();
    } catch (e) {
      const msg =
        e instanceof GuildError
          ? e.message
          : e instanceof Error
            ? e.message
            : "수락 실패";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <Card padding="md">
        <Skeleton rows={3} />
      </Card>
    );
  }

  if (!data?.guild) {
    // 길드 없음 — 패널 자체를 숨긴다 (호출 측에서 길드 존재 시에만 mount 권장).
    return null;
  }

  const { guild, active, proposed } = data;

  return (
    <Card padding="md">
      <div className="space-y-3">
        <header>
          <div className="flex items-center gap-2">
            <Trophy size={18} weight="duotone" className="text-amber-500" />
            <h3 className="text-base font-semibold">길드 의뢰</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            매주 월요일 00시(KST) 새 후보 3종이 발행됩니다.
          </p>
        </header>

        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        {active ? (
          <ActiveQuestCard instance={active} />
        ) : (
          <ProposedSection
            proposed={proposed}
            isMaster={guild.isMaster}
            busy={busy}
            onAccept={handleAccept}
          />
        )}
      </div>
    </Card>
  );
}

function ActiveQuestCard({ instance }: { instance: GuildQuestInstanceShape }) {
  const def = getGuildQuestById(instance.questDefId);
  if (!def) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        알 수 없는 의뢰 ({instance.questDefId})
      </p>
    );
  }
  const pct = Math.min(100, (instance.progress / instance.target) * 100);
  return (
    <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkle
            size={14}
            weight="fill"
            className="text-emerald-600 dark:text-emerald-400"
          />
          <span className="text-sm font-semibold">{def.name}</span>
          <span
            className={`text-[11px] font-bold ${GRADE_COLOR[def.grade] ?? ""}`}
          >
            [{def.grade}]
          </span>
        </div>
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {instance.progress} / {instance.target}
        </span>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {def.description}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        {describeTask(def)}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/60">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <RewardLine def={def} />
    </div>
  );
}

function ProposedSection({
  proposed,
  isMaster,
  busy,
  onAccept,
}: {
  proposed: GuildQuestInstanceShape[];
  isMaster: boolean;
  busy: boolean;
  onAccept: (id: number) => void;
}) {
  if (proposed.length === 0) {
    return (
      <EmptyState
        icon={<Scroll size={32} weight="duotone" />}
        title="이번 주 후보 의뢰가 없습니다"
        message="다음 월요일 00시(KST) 에 새 후보가 발행됩니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        후보 {proposed.length}종 — 마스터가 1개를 수락하면 나머지는 자동
        해제됩니다.
      </p>
      <ul className="space-y-2">
        {proposed.map((inst) => (
          <ProposedQuestRow
            key={inst.id}
            instance={inst}
            canAccept={isMaster}
            busy={busy}
            onAccept={() => onAccept(inst.id)}
          />
        ))}
      </ul>
      {!isMaster ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          수락은 마스터만 가능합니다.
        </p>
      ) : null}
    </div>
  );
}

function ProposedQuestRow({
  instance,
  canAccept,
  busy,
  onAccept,
}: {
  instance: GuildQuestInstanceShape;
  canAccept: boolean;
  busy: boolean;
  onAccept: () => void;
}) {
  const def = getGuildQuestById(instance.questDefId);
  if (!def) {
    return (
      <li className="rounded-md border border-zinc-200 p-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        알 수 없는 의뢰 ({instance.questDefId})
      </li>
    );
  }
  return (
    <li className="space-y-1.5 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{def.name}</span>
          <span
            className={`text-[11px] font-bold ${GRADE_COLOR[def.grade] ?? ""}`}
          >
            [{def.grade}]
          </span>
        </div>
        {canAccept ? (
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="rounded-md border border-emerald-700 bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            수락
          </button>
        ) : null}
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {def.description}
      </p>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
        {describeTask(def)}
      </p>
      <RewardLine def={def} />
    </li>
  );
}

function RewardLine({ def }: { def: GuildQuestDef }) {
  const r = def.reward;
  const parts: string[] = [];
  parts.push(`길드 명성 +${r.fame}`);
  parts.push(`멤버당 ${r.goldPerMember.toLocaleString()} G`);
  if (r.materialsPerMember && r.materialsPerMember.length > 0) {
    for (const m of r.materialsPerMember) {
      const name = MATERIALS[m.materialId]?.name ?? m.materialId;
      parts.push(`${name} ×${m.count}`);
    }
  }
  if (r.itemsPerMember && r.itemsPerMember.length > 0) {
    for (const it of r.itemsPerMember) {
      const name = ITEMS[it.itemId]?.name ?? it.itemId;
      parts.push(`${name} ×${it.count}`);
    }
  }
  return (
    <p className="text-[11px] text-amber-700 dark:text-amber-400">
      🎁 {parts.join(" · ")}
    </p>
  );
}

function describeTask(def: GuildQuestDef): string {
  const t = def.task;
  if (t.kind === "kill_monster") {
    return `${t.monsterName} ${t.count}마리 처치`;
  }
  if (t.kind === "kill_boss") {
    return `보스 ${t.monsterName} ${t.count}회 처치`;
  }
  if (t.kind === "collect_material") {
    const name = MATERIALS[t.materialId]?.name ?? t.materialId;
    return `${name} ${t.count}개 납품`;
  }
  return "";
}

