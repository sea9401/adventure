"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  GUILD_BUFF_IDS,
  GUILD_BUFFS,
  type GuildBuffId,
  type GuildBuffSlot,
} from "@/adventure/data/guildBuffs";
import {
  fetchGuildBuffs,
  installGuildBuff,
  uninstallGuildBuff,
  upgradeGuildBuff,
  GuildError,
} from "./api";
import {
  EmptySlotCard,
  InstalledSlotCard,
  LockedSlotCard,
  effectLabel,
} from "./buffSlots/BuffSlotCards";

type State = {
  isMaster: boolean;
  fameAvailable: number;
  maxSlots: number;
  buffs: GuildBuffSlot[];
  grade: string;
} | null;

export function GuildBuffsPanel({
  onChanged,
}: {
  // 마스터의 변경이 다른 곳(전투 보상 등)에 즉시 반영되도록 부모에서 캐시 갱신 트리거.
  onChanged?: () => void;
}) {
  const [state, setState] = useState<State>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { mode: "install" }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchGuildBuffs();
      setState(
        r.guild
          ? {
              isMaster: r.guild.isMaster,
              fameAvailable: r.guild.fameAvailable,
              maxSlots: r.guild.maxSlots,
              buffs: r.guild.buffs,
              grade: r.guild.grade,
            }
          : null,
      );
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

  const handleApiError = (e: unknown) => {
    const msg =
      e instanceof GuildError
        ? e.message
        : e instanceof Error
          ? e.message
          : "처리 실패";
    setError(msg);
  };

  const handleInstall = async (buffId: GuildBuffId) => {
    setBusy(true);
    setError(null);
    try {
      await installGuildBuff(buffId);
      setPicker(null);
      await load();
      onChanged?.();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleUpgrade = async (buffId: GuildBuffId) => {
    setBusy(true);
    setError(null);
    try {
      await upgradeGuildBuff(buffId);
      await load();
      onChanged?.();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async (buffId: GuildBuffId, name: string) => {
    if (!window.confirm(`${name} 슬롯을 해제하시겠습니까? (누적 투자의 50% 환급)`)) return;
    setBusy(true);
    setError(null);
    try {
      await uninstallGuildBuff(buffId);
      await load();
      onChanged?.();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !state) {
    return (
      <Card padding="md">
        <Skeleton rows={3} />
      </Card>
    );
  }
  if (!state) {
    return (
      <Card padding="md">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          길드에 소속되어 있어야 버프를 사용할 수 있습니다.
        </p>
      </Card>
    );
  }

  const installedIds = new Set(state.buffs.map((s) => s.buffId));
  const slotsView: (GuildBuffSlot | null)[] = [];
  for (let i = 0; i < state.maxSlots; i += 1) {
    slotsView.push(state.buffs[i] ?? null);
  }
  const hasEmpty = slotsView.some((s) => s === null);
  const totalLockedSlots = 4 - state.maxSlots;

  return (
    <Card padding="md">
      <div className="space-y-3">
        {error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">길드 버프</h4>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              슬롯 {state.buffs.length}/{state.maxSlots}
              {totalLockedSlots > 0
                ? ` · 잠금 ${totalLockedSlots} (등급 상승 시 해방)`
                : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              사용 가능 명성
            </p>
            <p className="text-lg font-bold leading-tight text-amber-600 dark:text-amber-400">
              {state.fameAvailable.toLocaleString()}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {slotsView.map((slot, i) => (
            <li key={i}>
              {slot ? (
                <InstalledSlotCard
                  slot={slot}
                  isMaster={state.isMaster}
                  busy={busy}
                  fameAvailable={state.fameAvailable}
                  onUpgrade={() => handleUpgrade(slot.buffId)}
                  onUninstall={() =>
                    handleUninstall(slot.buffId, GUILD_BUFFS[slot.buffId].name)
                  }
                />
              ) : (
                <EmptySlotCard
                  isMaster={state.isMaster}
                  busy={busy}
                  onPick={() => setPicker({ mode: "install" })}
                />
              )}
            </li>
          ))}
          {Array.from({ length: totalLockedSlots }).map((_, i) => (
            <li key={`locked-${i}`}>
              <LockedSlotCard />
            </li>
          ))}
        </ul>

        {picker && state.isMaster && hasEmpty ? (
          <BuffPickerModal
            installedIds={installedIds}
            fameAvailable={state.fameAvailable}
            busy={busy}
            onClose={() => setPicker(null)}
            onPick={(id) => void handleInstall(id)}
          />
        ) : null}
      </div>
    </Card>
  );
}

function BuffPickerModal({
  installedIds,
  fameAvailable,
  busy,
  onClose,
  onPick,
}: {
  installedIds: Set<GuildBuffId>;
  fameAvailable: number;
  busy: boolean;
  onClose: () => void;
  onPick: (id: GuildBuffId) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-semibold">버프 선택</h4>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          T1 신규 설치. 사용 가능 명성 {fameAvailable.toLocaleString()}.
        </p>
        <ul className="mt-3 space-y-2">
          {GUILD_BUFF_IDS.map((id) => {
            const def = GUILD_BUFFS[id];
            const t1 = def.tiers[0];
            const installed = installedIds.has(id);
            const canAfford = fameAvailable >= t1.installCost;
            const disabled = busy || installed || !canAfford;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(id)}
                  className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{def.name}</span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      T1 -{t1.installCost} 명성
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {def.description}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                    T1 효과: {effectLabel(def, t1.effect)}
                  </p>
                  {installed ? (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                      이미 설치됨
                    </p>
                  ) : !canAfford ? (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                      명성 부족
                    </p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
