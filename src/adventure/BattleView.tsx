"use client";

import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DispatchLogStream } from "@/components/game/LogStream";
import { REGIONS } from "@/lib/game/data";
import {
  computeStats,
  estimateWinChanceVsRegion,
  getActivePassive,
  getMonumentBonus,
} from "@/lib/game/logic";
import { useGame } from "@/lib/game/store";
import { formatGains, formatMaterials, formatSec, hasMaterials } from "@/lib/format";

import { CharacterStrip } from "./CharacterStrip";
import { DEFAULT_TOWN_ID, findTown } from "./data/towns";

const DUNGEON_DURATION = 60 as const;

export function BattleView() {
  return (
    <>
      <CharacterStrip />
      <CurrentTownDungeon />
    </>
  );
}

function CurrentTownDungeon() {
  const state = useGame();
  const town = findTown(state.currentTownId ?? DEFAULT_TOWN_ID) ?? findTown(DEFAULT_TOWN_ID);
  if (!town) return null;
  const region = REGIONS.find((r) => r.id === town.dungeonId);
  if (!region) {
    return (
      <Panel title={`${town.name} — 던전`}>
        <p className="text-xs text-red-400">던전 데이터 없음 ({town.dungeonId})</p>
      </Panel>
    );
  }

  const monBonus = getMonumentBonus(state.estate.monument, state.stats.bossKillCounts);
  const stats = computeStats(state.character, monBonus);
  const passive = getActivePassive(state.character);
  const winChance = estimateWinChanceVsRegion(stats, region.enemies, passive);
  const winLabel =
    winChance >= 0.9 ? "안전" : winChance >= 0.5 ? "위험" : winChance >= 0.2 ? "치명적" : "절망적";
  const winColor =
    winChance >= 0.9
      ? "text-emerald-400"
      : winChance >= 0.5
        ? "text-amber-400"
        : winChance >= 0.2
          ? "text-orange-400"
          : "text-red-400";

  // eslint-disable-next-line react-hooks/purity
  const remainingMs = state.dispatch ? Math.max(0, state.dispatch.endsAt - Date.now()) : 0;
  const inCombat = !!state.dispatch && !state.dispatch.isBoss;
  const lastBattle = state.lastBattles?.[0];
  const lastFieldBattle = lastBattle?.kind === "field" ? lastBattle : null;

  const restAtTown = () => {
    useGame.setState((s) => ({
      character: { ...s.character, currentHp: stats.maxHp },
      hpUpdatedAt: Date.now(),
    }));
  };

  const startBattle = () => {
    if (state.character.currentHp <= 0) return;
    state.startDispatch(region.id, DUNGEON_DURATION);
  };

  return (
    <>
      <Panel title={`${town.name} — ${region.name}`}>
        <p className="text-xs text-fg-faint">{region.flavor}</p>
        <div className="text-xs text-fg-dim mt-2 space-y-0.5">
          {region.enemies.map((e) => (
            <div key={e.name}>
              · {e.name} (HP {e.hp})
            </div>
          ))}
        </div>
        <div className={`text-xs ${winColor} mt-2`}>
          예상 승률: {winLabel} ({(winChance * 100).toFixed(0)}%)
        </div>

        {inCombat && state.dispatch && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-fg-faint">
              전투 진행 — {formatSec(Math.ceil(remainingMs / 1000))} 남음
            </p>
            <ProgressBar value={1 - remainingMs / (state.dispatch.durationSec * 1000)} />
            {state.combatLogEnabled && state.dispatch.dispatchResult && (
              <DispatchLogStream
                result={state.dispatch.dispatchResult}
                startedAt={state.dispatch.startedAt}
                characterMaxHp={stats.maxHp}
                totalDurationMs={state.dispatch.durationSec * 1000}
              />
            )}
            {state._resolving && <p className="text-xs text-fg-faint">정산 중...</p>}
          </div>
        )}

        {!state.dispatch && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={startBattle}
              disabled={state.character.currentHp <= 0}
              className="rounded-md bg-fg-strong text-canvas px-3 py-1.5 text-xs font-medium hover:bg-fg-strong/90 disabled:opacity-30"
            >
              {lastFieldBattle ? "다시 전투" : "전투 시작"}
            </button>
            <button
              onClick={restAtTown}
              disabled={state.character.currentHp >= stats.maxHp}
              className="rounded-md border border-line-2 text-fg-muted hover:bg-panel-2 hover:text-fg px-3 py-1.5 text-xs disabled:opacity-30"
            >
              휴식 (HP 풀회복)
            </button>
            <label className="ml-auto text-xs text-fg-faint flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={state.combatLogEnabled}
                onChange={() => state.toggleCombatLog()}
                className="accent-emerald-500"
              />
              실시간 로그
            </label>
          </div>
        )}

        {state.character.currentHp <= 0 && !state.dispatch && (
          <p className="text-xs text-red-400 mt-2">
            ⚠ HP가 0입니다. 휴식을 눌러 회복 후 다시 도전하세요.
          </p>
        )}
      </Panel>

      {lastFieldBattle && !state.dispatch && (
        <Panel title="최근 전투">
          <div className="text-sm">
            {lastFieldBattle.regionName} ·{" "}
            <span
              className={
                lastFieldBattle.result.diedEarly
                  ? "text-red-400"
                  : lastFieldBattle.result.totalKills === 0
                    ? "text-fg-faint"
                    : "text-emerald-400"
              }
            >
              {lastFieldBattle.result.diedEarly
                ? "조기 후퇴"
                : `${lastFieldBattle.result.totalKills}킬`}
            </span>
          </div>
          <div className="text-xs text-fg-dim mt-1">
            가한 {lastFieldBattle.result.damageDealt} / 받은 {lastFieldBattle.result.damageTaken}
            {lastFieldBattle.result.kills.length > 0 &&
              ` · ${lastFieldBattle.result.kills.map((k) => `${k.name}×${k.count}`).join(", ")}`}
          </div>
          <div className="text-xs text-fg-faint mt-1">
            {formatGains(lastFieldBattle.result.gained, lastFieldBattle.result.exp)}
          </div>
          {hasMaterials(lastFieldBattle.result.droppedMaterials) && (
            <div className="text-xs text-emerald-400 mt-0.5">
              재료: {formatMaterials(lastFieldBattle.result.droppedMaterials)}
            </div>
          )}
          {lastFieldBattle.result.treasure && (
            <div className="text-xs text-amber-400 mt-1">
              ★ {lastFieldBattle.result.treasure.name} 발견!
              {(lastFieldBattle.result.treasureHits ?? 1) > 1 && (
                <span className="ml-1 text-amber-300">×{lastFieldBattle.result.treasureHits}</span>
              )}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
