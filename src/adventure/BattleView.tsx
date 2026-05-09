"use client";

import { useEffect, useRef } from "react";
import { pickEnemyName, type Region } from "./data/world";
import { MONSTERS, type Monster } from "./data/monsters";
import type {
  BattleLogEntry,
  BattleOutcome,
  BattleState,
  PlayerAction,
  PlayerCombat,
} from "./battle/engine";
import { useBattle, computeBattleCooldown } from "./battle/useBattle";
import { BattleScene, type BattlePlayerStatus } from "./battle/BattleScene";
import { BattleResult } from "./battle/BattleResult";
import { EnemyEncounterSection } from "./EnemyEncounterSection";
import type { PotionId } from "./data/potions";
import type { InventoryState } from "./inventory/useInventory";
import type {
  AutoPotionConfig,
  AutoPotionRule,
} from "./inventory/useAutoPotionConfig";
import { AutoPotionSection } from "./inventory/AutoPotionSection";
import type { AppNotification } from "@/lib/notifications";
import { Card } from "@/components/ui/Card";

export type BattleEndPayload = {
  outcome: BattleOutcome;
  enemyName: string;
  finalPlayerHp: number;
  rewards: { exp: number };
  potionsConsumed: Partial<Record<PotionId, number>>;
  log: BattleLogEntry[];
};

function pickEnemy(region: Region): Monster | null {
  const name = pickEnemyName(region);
  return name ? (MONSTERS[name] ?? null) : null;
}

export function BattleView({
  region,
  player,
  playerName,
  playerStatus,
  onBattleStart,
  onBattleEnd,
  pickAutoAction,
  inventoryState,
  autoPotionConfig,
  onUpdateAutoPotionRule,
  recentNotifications,
  huntingActive,
  onToggleHunting,
  bossAttemptsToday,
  onConsumeBossAttempt,
}: {
  region: Region;
  player: PlayerCombat;
  playerName: string;
  playerStatus: BattlePlayerStatus;
  onBattleStart?: (enemyName: string) => void;
  onBattleEnd: (payload: BattleEndPayload) => void;
  pickAutoAction: (state: BattleState) => PlayerAction;
  inventoryState: InventoryState;
  autoPotionConfig: AutoPotionConfig;
  onUpdateAutoPotionRule: (
    index: number,
    patch: Partial<AutoPotionRule>,
  ) => void;
  recentNotifications?: AppNotification[];
  huntingActive: boolean;
  onToggleHunting: (next: boolean) => void;
  /** region.boss 가 정의된 경우 — 오늘 입장한 횟수. */
  bossAttemptsToday?: number;
  /** 보스 도전 1회 입장 카운트. 호출자가 한도 검사 후 호출. */
  onConsumeBossAttempt?: () => void;
}) {
  const { state, potionsConsumed, start, stop } = useBattle({
    player,
    playerName,
    pickAction: pickAutoAction,
    potions: inventoryState.potions,
  });

  // 보스 전투 모드 — 일반 자동사냥 루프와 분리. 1회 전투 후 종료, 자동 다음 적 X.
  const bossModeRef = useRef(false);

  const startWithLog = (enemy: Monster, hpOverride?: number) => {
    onBattleStart?.(enemy.name);
    start(enemy, hpOverride);
  };

  // 전투 종료 시 onBattleEnd 발화. 승리는 즉시 보상 적용 + cooldown 후 다음 적 자동 진행.
  // 패배는 BattleResult 모달에서 사용자 확인을 받은 뒤에야 발화 — 시작 마을 강제 이동이
  // BattleView unmount를 유발하므로 모달이 사라지지 않게.
  const onBattleEndRef = useRef(onBattleEnd);
  useEffect(() => {
    onBattleEndRef.current = onBattleEnd;
  });

  const firedForStateRef = useRef<BattleState | null>(null);
  useEffect(() => {
    if (!state || state.phase !== "ended" || !state.outcome) return;
    if (firedForStateRef.current === state) return;
    if (state.outcome !== "win") return; // 패배는 confirm 시 발화
    firedForStateRef.current = state;
    try {
      onBattleEndRef.current({
        outcome: state.outcome,
        enemyName: state.enemy.name,
        finalPlayerHp: state.playerHp,
        rewards: { exp: state.enemy.exp },
        potionsConsumed,
        log: state.log,
      });
    } catch (err) {
      // 핸들러 실패 시 ref 해제 — 다음 effect 실행에서 재시도 가능.
      firedForStateRef.current = null;
      console.error("onBattleEnd failed:", err);
    }
  }, [state, potionsConsumed]);

  // 승리 시 로그 길이에 비례한 cooldown 후 다음 적 자동 시작.
  // ref로 latest region/state 캡처해 setTimeout 클로저 stale 방지.
  const region_ref = useRef(region);
  useEffect(() => {
    region_ref.current = region;
  });
  useEffect(() => {
    if (!state || state.phase !== "ended" || state.outcome !== "win") return;
    // 보스 승리는 결과 모달 확인 후 종료 — 자동 cooldown/다음 적 X.
    // 동기 시뮬 특성상 즉시 stop() 하면 BattleScene 이 한 프레임만 보이고 사라진다.
    if (bossModeRef.current) return;
    const cooldown = computeBattleCooldown(state.log.length);
    const finalHp = state.playerHp;
    const id = setTimeout(() => {
      const nextEnemy = pickEnemy(region_ref.current);
      if (nextEnemy) {
        startWithLog(nextEnemy, finalHp);
      } else {
        stop();
      }
    }, cooldown);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // 자동 사냥 ON 상태로 BattleView 에 진입 — state 가 비어있고 싸울 수 있으면 즉시 첫 전투 시작.
  // 다른 in-app 탭(캐릭터/광장 등) 갔다 돌아왔을 때 "전투 시작" 버튼 누르지 않아도 이어서 진행.
  useEffect(() => {
    if (state !== null) return;
    if (!huntingActive) return;
    if (player.hp <= 0) return;
    if (region.enemies.length === 0) return;
    if (bossModeRef.current) return; // 보스 전투 직후 자동 다음 적 시작 차단
    const enemy = pickEnemy(region);
    if (enemy) startWithLog(enemy);
    // startWithLog 는 setter — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, huntingActive, player.hp, region]);

  // 1) 전투 외 — 진입 화면
  if (!state) {
    const hasEnemies = region.enemies.length > 0;
    const boss = region.boss;
    const bossMonster = boss ? (MONSTERS[boss.monsterName] ?? null) : null;
    const attemptsUsed = bossAttemptsToday ?? 0;
    const attemptsLeft = boss
      ? Math.max(0, boss.dailyEntryLimit - attemptsUsed)
      : 0;
    const canBoss = !!bossMonster && attemptsLeft > 0 && player.hp > 0;
    return (
      <div className="space-y-3">
        <Card padding="md">
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            현재 위치
          </div>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {region.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {region.description}
          </p>
        </Card>

        {boss && bossMonster && (
          <Card padding="md">
            <div className="text-xs uppercase tracking-wider text-rose-500 dark:text-rose-400">
              보스
            </div>
            <h4 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {bossMonster.name}
            </h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              일일 도전 — 오늘 {attemptsUsed}/{boss.dailyEntryLimit} 사용 (자정에 초기화)
            </p>
            <button
              type="button"
              disabled={!canBoss}
              onClick={() => {
                if (!bossMonster || !onConsumeBossAttempt) return;
                onConsumeBossAttempt();
                bossModeRef.current = true;
                startWithLog(bossMonster);
              }}
              className="mt-3 w-full rounded-md border border-rose-700 bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {player.hp <= 0
                ? "회복 필요"
                : attemptsLeft <= 0
                  ? "오늘 도전 횟수 소진"
                  : `보스 도전 (남은 ${attemptsLeft}/${boss.dailyEntryLimit})`}
            </button>
          </Card>
        )}

        {hasEnemies ? (
          <>
            <EnemyEncounterSection region={region} />
            <button
              type="button"
              onClick={() => {
                const enemy = pickEnemy(region);
                if (enemy) startWithLog(enemy);
              }}
              disabled={player.hp <= 0}
              className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {player.hp <= 0 ? "회복 필요" : "전투 시작"}
            </button>
            <button
              type="button"
              onClick={() => onToggleHunting(!huntingActive)}
              aria-pressed={huntingActive}
              disabled={player.hp <= 0}
              className={`w-full rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                huntingActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:border-emerald-400 dark:text-emerald-300"
                  : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 rounded-full ${
                    huntingActive
                      ? "bg-emerald-500"
                      : "bg-zinc-400 dark:bg-zinc-600"
                  }`}
                />
                오프라인 사냥 {huntingActive ? "ON" : "OFF"}
              </span>
            </button>
            <p className="-mt-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              ON 상태로 페이지/탭을 떠났다가 돌아오면 그 동안의 사냥이 한 번에 적용됩니다 (최대 30분).
            </p>
            <AutoPotionSection
              autoConfig={autoPotionConfig}
              inventory={inventoryState}
              onUpdateRule={onUpdateAutoPotionRule}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-400">
            이곳에는 전투할 적이 없습니다.
          </div>
        )}
      </div>
    );
  }

  // 2) 진행 중 / 승리 cooldown — 같은 화면. final state(전체 로그 + final HP)을 그대로 보여준다.
  // 일반 승리는 cooldown 동안 BattleScene 만 보이고, 패배 / 보스 승리는 결과 모달이 위에 뜬다.
  const isLoss =
    state.phase === "ended" && state.outcome === "lose";
  const isBossWin =
    state.phase === "ended" &&
    state.outcome === "win" &&
    bossModeRef.current;
  return (
    <>
      <BattleScene
        state={state}
        playerName={playerName}
        playerStatus={playerStatus}
        recentNotifications={recentNotifications}
      />
      {isLoss && (
        <BattleResult
          outcome="lose"
          exp={0}
          onConfirm={() => {
            // 더블탭/연속 클릭으로 onBattleEnd 가 중복 발화하지 않도록 가드.
            if (firedForStateRef.current === state) return;
            firedForStateRef.current = state;
            try {
              onBattleEndRef.current({
                outcome: "lose",
                enemyName: state.enemy.name,
                finalPlayerHp: 0,
                rewards: { exp: 0 },
                potionsConsumed,
                log: state.log,
              });
            } catch (err) {
              firedForStateRef.current = null;
              console.error("onBattleEnd failed:", err);
            }
            // BattleView 로컬 state 초기화 — 모달 닫고 진입 화면으로 복귀.
            stop();
          }}
        />
      )}
      {isBossWin && (
        <BattleResult
          outcome="win"
          exp={state.enemy.exp}
          onConfirm={() => {
            // 보상은 win effect 가 이미 발화 — 모달 확인은 BattleScene 정리만.
            bossModeRef.current = false;
            stop();
          }}
        />
      )}
    </>
  );
}
