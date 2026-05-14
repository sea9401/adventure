"use client";

import { useState } from "react";
import { ArrowsClockwise, Coins, Crown, Skull, Star, X } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { useEscapeKey } from "@/lib/useEscapeKey";
import type { BattleState } from "@/adventure/battle/engine";
import {
  BattleScene,
  type BattlePlayerStatus,
} from "@/adventure/battle/BattleScene";
import type { Monster } from "@/adventure/data/monsters";
import { MONSTERS } from "@/adventure/data/monsters";
import {
  isBossFloor,
  scaledStats,
  startFloorAfterCheckpoint,
} from "./scaling";
import {
  BOSS_SLOTS,
  bossBaseMonster,
  bossDisplayName,
  bossSlotForFloor,
  mobPoolForFloor,
  pickMobFromPool,
} from "./floorPools";
import { milestoneFor } from "./rewards";
import { TOWER_DAILY_ATTEMPTS, type TowerState } from "./types";
import { useTower, type TowerApiResponse } from "./useTower";

// 고탑 진입 모달 — 한 컴포넌트 안에서 entry / ready / result / run_ended 화면을 전환.
// 전투는 서버 측 resolveBattle 이 수행. 클라는 의도(fight_floor) 만 보내고 응답으로 받은
// BattleState 를 BattleScene 에 그대로 넘긴다 (anti-cheat).

type View =
  | { kind: "entry" } // 시작 또는 이어하기 선택
  | { kind: "ready"; floor: number; enemy: Monster; isBoss: boolean }
  | { kind: "result"; outcome: "win" | "lose"; floor: number; enemy: Monster; finalState: BattleState }
  | { kind: "run_ended"; lastFloor: number };

export function TowerModal({
  onClose,
  playerName,
  playerStatus,
  onApplied,
}: {
  onClose: () => void;
  playerName: string;
  /** BattleScene 의 HUD (MP/EXP 바, 캐릭터 아바타) 에 필요한 상태. */
  playerStatus: BattlePlayerStatus;
  /** 마일스톤 보상으로 character/inventory 가 갱신되면 호출 — 부모에서 state 동기화. */
  onApplied?: (r: TowerApiResponse) => void;
}) {
  const tower = useTower({ onApplied });
  const [view, setView] = useState<View>({ kind: "entry" });
  useEscapeKey(onClose);

  const state = tower.state;
  const runActive = state.run !== null;

  // 결과 화면에선 BattleScene 을 넣어야 해서 모달을 더 넓게 — 그 외엔 컴팩트.
  const wide = view.kind === "result";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tower-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2
              id="tower-modal-title"
              className="flex items-center gap-1.5 text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              <Crown size={18} weight="duotone" className="text-amber-500" />
              고탑
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              영원히 끝나지 않는 수직 미궁. 10층마다 보스가 길을 막는다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {view.kind === "entry" && (
          <EntryView
            state={state}
            pending={tower.pending}
            error={tower.error}
            onStart={async () => {
              const r = await tower.start();
              if (r.ok && r.tower?.run) {
                const floor = r.tower.run.currentFloor;
                setView(buildReady(floor));
              }
            }}
            onResume={() => {
              if (state.run) setView(buildReady(state.run.currentFloor));
            }}
            onForfeit={async () => {
              await tower.forfeit();
            }}
          />
        )}

        {view.kind === "ready" && (
          <ReadyView
            floor={view.floor}
            enemy={view.enemy}
            isBoss={view.isBoss}
            disabled={tower.pending !== null}
            onFight={async () => {
              const apiResult = await tower.fightFloor();
              if (!apiResult.ok || !apiResult.battle) return;
              const outcome =
                apiResult.applied?.outcome === "lose" ? "lose" : "win";
              setView({
                kind: "result",
                outcome,
                floor: view.floor,
                enemy: { ...view.enemy, name: apiResult.battle.enemyName },
                finalState: apiResult.battle.finalState,
              });
            }}
            onForfeit={async () => {
              await tower.forfeit();
              setView({ kind: "run_ended", lastFloor: view.floor - 1 });
            }}
          />
        )}

        {view.kind === "result" && (
          <ResultView
            outcome={view.outcome}
            floor={view.floor}
            enemy={view.enemy}
            finalState={view.finalState}
            milestone={apparentMilestone(view.outcome, view.floor)}
            playerName={playerName}
            playerStatus={playerStatus}
            onNext={() => {
              if (view.outcome === "win") {
                // 다음 층 — 서버 응답에 따라 currentFloor 가 이미 +1 됐을 것.
                const nextFloor = state.run?.currentFloor ?? view.floor + 1;
                setView(buildReady(nextFloor));
              } else {
                setView({ kind: "run_ended", lastFloor: view.floor - 1 });
              }
            }}
          />
        )}

        {view.kind === "run_ended" && (
          <RunEndedView
            state={state}
            lastFloor={view.lastFloor}
            onClose={() => setView({ kind: "entry" })}
          />
        )}

        {!runActive && view.kind !== "entry" && view.kind !== "run_ended" && (
          // 안전망 — 서버 측 run 이 비었는데 화면이 ready/result 면 entry 로 복귀.
          <button
            type="button"
            onClick={() => setView({ kind: "entry" })}
            className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            돌아가기
          </button>
        )}
      </div>
    </div>
  );
}

function apparentMilestone(outcome: "win" | "lose", floor: number) {
  if (outcome !== "win") return null;
  if (!isBossFloor(floor)) return null;
  return milestoneFor(floor);
}

function buildReady(floor: number): View {
  const slot = bossSlotForFloor(floor);
  if (slot) {
    const base = bossBaseMonster(slot);
    const scaled = scaledStats(base, floor, slot.bossMultiplier);
    const enemy: Monster = {
      ...base,
      name: bossDisplayName(slot),
      hp: scaled.hp,
      atk: scaled.atk,
      def: scaled.def,
      spd: scaled.spd,
    };
    return { kind: "ready", floor, enemy, isBoss: true };
  }
  const pool = mobPoolForFloor(floor);
  if (pool.length === 0) {
    // 매핑 실패 안전망 — 빈 풀이면 첫 보스 슬롯의 베이스를 사용.
    const fb = BOSS_SLOTS[0];
    const base = bossBaseMonster(fb);
    const scaled = scaledStats(base, floor);
    return {
      kind: "ready",
      floor,
      enemy: { ...base, name: `${floor}층의 도전자`, ...scaled },
      isBoss: false,
    };
  }
  const name = pickMobFromPool(pool);
  // 풀에 있는 이름은 MONSTERS 키여야 함. 없으면 풀 첫 항목 또는 baseline 폴백.
  const base =
    MONSTERS[name] ?? MONSTERS[pool[0]] ?? bossBaseMonster(BOSS_SLOTS[0]);
  const scaled = scaledStats(base, floor);
  return {
    kind: "ready",
    floor,
    enemy: { ...base, ...scaled },
    isBoss: false,
  };
}

function EntryView({
  state,
  pending,
  error,
  onStart,
  onResume,
  onForfeit,
}: {
  state: TowerState;
  pending: string | null;
  error: string | null;
  onStart: () => Promise<void>;
  onResume: () => void;
  onForfeit: () => Promise<void>;
}) {
  const runActive = state.run !== null;
  const attemptsUsed = state.daily?.attempts ?? 0;
  const attemptsLeft = Math.max(0, TOWER_DAILY_ATTEMPTS - attemptsUsed);
  return (
    <div className="space-y-3">
      <Card padding="md">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Stat label="최고 도달" value={`${state.progress.highestFloor}층`} />
          <Stat label="오늘 시도" value={`${attemptsUsed} / ${TOWER_DAILY_ATTEMPTS}`} />
        </div>
        {state.progress.claimedMilestones.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>받은 마일스톤:</span>
            {state.progress.claimedMilestones.sort((a, b) => a - b).map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400"
              >
                <Star size={10} weight="fill" />
                F{f}
              </span>
            ))}
          </div>
        )}
      </Card>

      {runActive ? (
        <Card padding="md">
          <p className="text-sm">
            진행 중인 시도 — 현재 <b>{state.run!.currentFloor}층</b>.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onResume}
              disabled={pending !== null}
              className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              이어하기
            </button>
            <button
              type="button"
              onClick={onForfeit}
              disabled={pending !== null}
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              {pending === "forfeit" ? "포기 중..." : "포기"}
            </button>
          </div>
        </Card>
      ) : (
        <Card padding="md">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            새 시도. 다음 시작 층:{" "}
            <b>{startFloorAfterCheckpoint(state.progress.highestFloor)}</b>층.
          </p>
          <button
            type="button"
            onClick={onStart}
            disabled={attemptsLeft <= 0 || pending !== null}
            className="mt-3 w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === "start"
              ? "시작 중..."
              : attemptsLeft <= 0
                ? "오늘 시도 소진"
                : `도전 시작 (남은 ${attemptsLeft}회)`}
          </button>
        </Card>
      )}

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">에러: {error}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function ReadyView({
  floor,
  enemy,
  isBoss,
  disabled,
  onFight,
  onForfeit,
}: {
  floor: number;
  enemy: Monster;
  isBoss: boolean;
  disabled: boolean;
  onFight: () => Promise<void>;
  onForfeit: () => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <Card padding="md">
        <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {floor}층 {isBoss ? "· 보스" : ""}
        </div>
        <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {enemy.name}
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          HP {enemy.hp} · ATK {enemy.atk} · DEF {enemy.def} · SPD {enemy.spd}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onFight}
            disabled={disabled}
            className="flex-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            전투 진입
          </button>
          <button
            type="button"
            onClick={onForfeit}
            disabled={disabled}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            포기
          </button>
        </div>
      </Card>
    </div>
  );
}

function ResultView({
  outcome,
  floor,
  enemy,
  finalState,
  milestone,
  playerName,
  playerStatus,
  onNext,
}: {
  outcome: "win" | "lose";
  floor: number;
  enemy: Monster;
  finalState: BattleState;
  milestone: ReturnType<typeof milestoneFor>;
  playerName: string;
  playerStatus: BattlePlayerStatus;
  onNext: () => void;
}) {
  return (
    <div className="space-y-3">
      <Card padding="md">
        <div
          className={`text-xs uppercase tracking-wider ${
            outcome === "win"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {floor}층 — {outcome === "win" ? "클리어" : "패배"}
        </div>
        <h3 className="mt-1 flex items-center gap-1.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {outcome === "win" ? (
            <Star size={16} weight="fill" className="text-amber-500" />
          ) : (
            <Skull size={16} weight="duotone" className="text-rose-500" />
          )}
          {enemy.name}
        </h3>
        {milestone && (
          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <div className="font-semibold">첫 도달 보상!</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {milestone.gold ? (
                <span className="inline-flex items-center gap-0.5">
                  <Coins size={11} weight="fill" />
                  {milestone.gold.toLocaleString()}
                </span>
              ) : null}
              {milestone.materials?.map((m) => (
                <span key={m.id}>
                  {m.id} ×{m.count}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 전투 로그 + 최종 HP/MP/EXP 가 한 화면에 — 일반 BattleView 와 같은 BattleScene. */}
      <BattleScene
        state={finalState}
        playerName={playerName}
        playerStatus={playerStatus}
      />

      <button
        type="button"
        onClick={onNext}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {outcome === "win" ? "다음 층" : "결과 보기"}
      </button>
    </div>
  );
}

function RunEndedView({
  state,
  lastFloor,
  onClose,
}: {
  state: TowerState;
  lastFloor: number;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <Card padding="md">
        <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          시도 종료
        </div>
        <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          도달 {lastFloor}층
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          최고 기록 {state.progress.highestFloor}층.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          <ArrowsClockwise size={14} />
          돌아가기
        </button>
      </Card>
    </div>
  );
}
