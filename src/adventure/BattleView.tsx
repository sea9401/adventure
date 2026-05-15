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
import {
  useBattle,
  computeBattleCooldown,
  BATTLE_TURN_CLAMP,
} from "./battle/useBattle";
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
import { applyNewbieBonus } from "@/lib/leveling";
import { AutoHuntCard } from "./battle/AutoHuntCard";
import type { AutoHuntHook } from "./hunting/useAutoHunt";

export type BattleEndPayload = {
  outcome: BattleOutcome;
  enemyName: string;
  finalPlayerHp: number;
  /** 그 전투에서 플레이어가 가졌던 최대 HP — kill_within_hp 의뢰 판정용. */
  playerMaxHp: number;
  /** exp 는 신참 보너스가 적용된 최종 적립값. expBonusApplied 는 토스트/표시 단서. */
  rewards: { exp: number; expBonusApplied: boolean };
  potionsConsumed: Partial<Record<PotionId, number>>;
  log: BattleLogEntry[];
};

function pickEnemy(region: Region): Monster | null {
  const name = pickEnemyName(region);
  return name ? (MONSTERS[name] ?? null) : null;
}

// 직전 전투 종료 시각·쿨다운 — BattleView 가 unmount 돼도 유지된다 (모듈 스코프).
// 전투 화면을 나갔다 다시 들어와도(= "전투" 버튼 ↔ "뒤로가기" 연타 포함) 다음 전투가
// 쿨다운을 건너뛰고 즉시 시작되던 문제를 막는다 — 화면에 머물 때와 같은 페이스로 제한.
// 페이지 새로고침 시 0 으로 리셋되지만, 그땐 즉시 시작이 맞는 동작이라 무방.
let lastBattleEndAt = 0;
let lastBattleCooldownMs = 0;

export function BattleView({
  region,
  player,
  playerLevel,
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
  autoHunt,
  bossAttemptsToday,
  onConsumeBossAttempt,
  onBossAttempt,
  bossAttemptBonus = 0,
  bossOnlyMode = false,
}: {
  region: Region;
  player: PlayerCombat;
  /** 신참 EXP ×2 보너스 판정용. */
  playerLevel: number;
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
  /** 타이머형 자동 사냥(6시간 원정) hook — page.tsx 에서 1회 생성해 주입. */
  autoHunt: AutoHuntHook;
  /** region.boss 가 정의된 경우 — 오늘 입장한 횟수. */
  bossAttemptsToday?: number;
  /** 보스 도전 1회 입장 카운트. 호출자가 한도 검사 후 호출. */
  onConsumeBossAttempt?: () => void;
  /** 보스 도전 클릭 시점에 호출 — 부모에서 장비 미착용 등 조건성 칭호 판정. */
  onBossAttempt?: () => void;
  /** 길드 buff "결의의 깃발" 가산 — 보스 일일 도전 횟수 +N. */
  bossAttemptBonus?: number;
  /**
   * true 면 일반 사냥 섹션 숨기고 보스 카드만 노출. 모험 탭의 "보스" 서브뷰용.
   * false (기본) 면 사냥 섹션만 노출하고 보스 카드는 숨김 — 보스는 별도 서브뷰에 있음.
   */
  bossOnlyMode?: boolean;
}) {
  const { state, potionsConsumed, start, stop } = useBattle({
    player,
    playerName,
    pickAction: pickAutoAction,
    potions: inventoryState.potions,
  });

  // 보스 전투 모드 — 일반 자동사냥 루프와 분리. 1회 전투 후 종료, 자동 다음 적 X.
  const bossModeRef = useRef(false);

  const startWithLog = (
    enemy: Monster,
    hpOverride?: number,
    isBoss?: boolean,
  ) => {
    onBattleStart?.(enemy.name);
    start(enemy, hpOverride, isBoss);
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
    const expBonus = applyNewbieBonus(state.enemy.exp, playerLevel);
    try {
      onBattleEndRef.current({
        outcome: state.outcome,
        enemyName: state.enemy.name,
        finalPlayerHp: state.playerHp,
        playerMaxHp: state.playerMaxHp,
        rewards: { exp: expBonus.gained, expBonusApplied: expBonus.bonusApplied },
        potionsConsumed,
        log: state.log,
      });
    } catch (err) {
      // 핸들러 실패 시 ref 해제 — 다음 effect 실행에서 재시도 가능.
      firedForStateRef.current = null;
      console.error("onBattleEnd failed:", err);
    }
  }, [state, potionsConsumed, playerLevel]);

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
    // 쿨다운은 전투에 걸린 턴 수 기준 — BATTLE_TURN_CLAMP 턴으로 클램프해
    // 자동 사냥 페이싱을 일정 범위(1200~4200ms)로 제한한다.
    const cooldown = computeBattleCooldown(
      Math.min(state.turn.completedPlayerTurns, BATTLE_TURN_CLAMP),
    );
    const finalHp = state.playerHp;
    // 이 전투 종료 시각·쿨다운을 모듈 스코프에 기록 — unmount 후 재진입 시 이어받는다.
    lastBattleEndAt = Date.now();
    lastBattleCooldownMs = cooldown;
    // 사냥 OFF 면 직전 전투의 결과만 잠깐 보여주고 stop() 으로 사전 화면 복귀 — 거기서
    // AutoPotionSection / "사냥 시작" 버튼에 다시 접근 가능. (예전엔 그냥 return 이라
    // ended 상태로 멈춰서 사용자가 물약 규칙 등을 못 바꾸는 데드락이 있었음.)
    if (!huntingActive) {
      const id = setTimeout(() => {
        stop();
      }, cooldown);
      return () => clearTimeout(id);
    }
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
  }, [state, huntingActive]);

  // 자동 사냥 ON 상태로 BattleView 에 진입 — state 가 비어있고 싸울 수 있으면 첫 전투 시작.
  // 다른 in-app 탭(캐릭터/광장 등) 갔다 돌아왔을 때 "전투 시작" 버튼 누르지 않아도 이어서 진행.
  // 단, 직전 전투 쿨다운이 남아있으면 그만큼 기다렸다 시작 — 화면을 나갔다 다시 들어와도
  // ("전투" 버튼 ↔ "뒤로가기" 연타 포함) 전투가 쿨다운을 건너뛰지 않게.
  useEffect(() => {
    if (state !== null) return;
    if (!huntingActive) return;
    if (autoHunt.isDispatched) return; // 위탁 사냥 중엔 라이브 자동전투 시작 안 함
    if (player.hp <= 0) return;
    if (region.enemies.length === 0) return;
    if (bossModeRef.current) return; // 보스 전투 직후 자동 다음 적 시작 차단
    const wait = Math.max(
      0,
      lastBattleCooldownMs - (Date.now() - lastBattleEndAt),
    );
    const id = setTimeout(() => {
      const enemy = pickEnemy(region_ref.current);
      if (enemy) startWithLog(enemy);
    }, wait);
    return () => clearTimeout(id);
    // startWithLog 는 setter — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, huntingActive, autoHunt.isDispatched, player.hp, region]);

  // 1) 전투 외 — 진입 화면
  if (!state) {
    const hasEnemies = region.enemies.length > 0;
    const boss = region.boss;
    const bossMonster = boss ? (MONSTERS[boss.monsterName] ?? null) : null;
    const attemptsUsed = bossAttemptsToday ?? 0;
    const dailyLimit = boss
      ? boss.dailyEntryLimit + bossAttemptBonus
      : 0;
    const attemptsLeft = boss ? Math.max(0, dailyLimit - attemptsUsed) : 0;
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

        {bossOnlyMode ? (
          boss && bossMonster ? (
            <>
              <Card padding="md">
                <div className="text-xs uppercase tracking-wider text-rose-500 dark:text-rose-400">
                  보스
                </div>
                <h4 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {bossMonster.name}
                </h4>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  일일 도전 — 오늘 {attemptsUsed}/{dailyLimit} 사용 (자정에 초기화)
                  {bossAttemptBonus > 0
                    ? ` · 길드 +${bossAttemptBonus}`
                    : ""}
                </p>
                <button
                  type="button"
                  disabled={!canBoss || autoHunt.isDispatched}
                  onClick={() => {
                    if (!bossMonster || !onConsumeBossAttempt) return;
                    if (autoHunt.isDispatched) return;
                    onConsumeBossAttempt();
                    onBossAttempt?.();
                    bossModeRef.current = true;
                    if (huntingActive) onToggleHunting(false);
                    startWithLog(bossMonster, undefined, true);
                  }}
                  className="mt-3 w-full rounded-md border border-rose-700 bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {autoHunt.isDispatched
                    ? "자동 사냥 중 — 보스 도전 불가"
                    : player.hp <= 0
                      ? "회복 필요"
                      : attemptsLeft <= 0
                        ? "오늘 도전 횟수 소진"
                        : `보스 도전 (남은 ${attemptsLeft}/${dailyLimit})`}
                </button>
              </Card>
              {/* 자동 포션 룰 — 도전 버튼 직전에 점검할 수 있게 보스 카드 바로 아래에 노출.
                  pickAutoAction 은 이미 같은 rules 를 보스 전투에도 적용 중이라 UI 만 추가. */}
              <AutoPotionSection
                autoConfig={autoPotionConfig}
                inventory={inventoryState}
                onUpdateRule={onUpdateAutoPotionRule}
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-400">
              이 지역엔 도전할 보스가 없다.
            </div>
          )
        ) : hasEnemies ? (
          <>
            <EnemyEncounterSection region={region} />
            <button
              type="button"
              onClick={() => {
                if (autoHunt.isDispatched) return;
                onToggleHunting(!huntingActive);
              }}
              aria-pressed={huntingActive}
              disabled={player.hp <= 0 || autoHunt.isDispatched}
              className={`w-full rounded-md border px-3 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                huntingActive
                  ? "border-rose-500 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:border-rose-400 dark:text-rose-300"
                  : "border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 rounded-full ${
                    huntingActive
                      ? "animate-pulse bg-rose-500"
                      : "bg-white/90"
                  }`}
                />
                {autoHunt.isDispatched
                  ? "자동 사냥 중 — 라이브 사냥 불가"
                  : player.hp <= 0
                    ? "회복 필요"
                    : huntingActive
                      ? "사냥 정지"
                      : "사냥 시작"}
              </span>
            </button>
            <p className="-mt-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              사냥 시작 시 이 화면에서 자동 전투가 이어집니다. 다른 탭(캐릭터/광장 등)
              또는 브라우저 백그라운드로 가면 사냥이 멈췄다가, 이 화면으로 돌아오면
              다시 이어집니다. 정지 시 진행 중 전투는 끝까지 처리되고 다음 적은
              잡지 않습니다.
            </p>
            <AutoHuntCard
              autoHunt={autoHunt}
              canDispatch={player.hp > 0 && hasEnemies}
            />
            <AutoPotionSection
              autoConfig={autoPotionConfig}
              inventory={inventoryState}
              onUpdateRule={onUpdateAutoPotionRule}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-400">
            {region.tags?.includes("town")
              ? "평화로운 마을이다. 검을 거두자."
              : "이곳엔 위협이 없다. 다른 곳으로 향하자."}
          </div>
        )}
      </div>
    );
  }

  // 2) 진행 중 / 승리 cooldown — 같은 화면. final state(전체 로그 + final HP)을 그대로 보여준다.
  // 일반 승리는 cooldown 동안 BattleScene 만 보이고, 패배 / 보스 승리는 결과 모달이 위에 뜬다.
  const isLoss =
    state.phase === "ended" && state.outcome === "lose";
  // 보스 승리 판정은 state 에서 derive — region.boss 와 enemy 이름 일치.
  // 보스 몬스터는 일반 인카운터 풀에서 제외돼 있어 안전한 식별자.
  const isBossWin =
    state.phase === "ended" &&
    state.outcome === "win" &&
    !!region.boss &&
    state.enemy.name === region.boss.monsterName;
  return (
    <>
      <BattleScene
        state={state}
        playerName={playerName}
        playerStatus={playerStatus}
        recentNotifications={recentNotifications}
      />
      {/* 진행 중 사냥 정지 — 클릭 시 현재 전투는 끝까지 진행되고, 끝나면 사전 화면으로
          복귀해 AutoPotionSection / "사냥 시작" 버튼에 다시 접근 가능. */}
      {huntingActive && !bossModeRef.current && (
        <button
          type="button"
          onClick={() => onToggleHunting(false)}
          className="w-full rounded-md border border-rose-500 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-500/20 dark:border-rose-400 dark:text-rose-300"
        >
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            사냥 정지 — 사전 화면으로
          </span>
        </button>
      )}
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
                playerMaxHp: state.playerMaxHp,
                rewards: { exp: 0, expBonusApplied: false },
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
      {isBossWin && (() => {
        const expBonus = applyNewbieBonus(state.enemy.exp, playerLevel);
        return (
        // 보스 승리는 모달 대신 인라인 — 사용자가 BattleScene 의 전투 로그를 즉시 확인 가능.
        // 보상/onBattleEnd 는 win effect 에서 이미 발화. "돌아가기" 가 BattleScene 정리만 담당.
        <Card padding="md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                승리!
              </div>
              <div className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                EXP +{expBonus.gained}
                {expBonus.bonusApplied && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    (신참 ×2)
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                bossModeRef.current = false;
                stop();
              }}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              돌아가기
            </button>
          </div>
        </Card>
        );
      })()}
    </>
  );
}
