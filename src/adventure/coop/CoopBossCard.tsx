"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  COOP_BOSSES,
  COOP_TIER_LABEL,
  COOP_TIER_THRESHOLDS,
  type CoopRewardTier,
} from "./data";
import { useCoopBoss, type CoopClaimResponse } from "./useCoopBoss";
import type { AppliedCoopReward } from "./applyReward";
import type { RegionId } from "@/adventure/data/world";
import type { BattleLogEntry } from "@/adventure/battle/engine";
import { MONSTERS } from "@/adventure/data/monsters";

type Props = {
  regionId: string;
  playerName: string;
  /** 공격 직후 캐릭터 hp 갱신. 서버가 derive 한 hp 를 그대로 반영. */
  onPlayerHpChange: (hp: number) => void;
  /** claim 보상 적용 — 재료/제작서/칭호. 실제 들어온 항목 요약을 반환. */
  applyReward: (reward: CoopClaimResponse["reward"]) => AppliedCoopReward;
  /** 토스트 등 알림. */
  notify?: (text: string) => void;
  /** 협동 공격 라운드 1회의 결과를 최근 기록의 "전투 로그" 탭에 남기기 위한 콜백. */
  notifyBattle?: (
    kind: "battle_win" | "battle_lose",
    text: string,
    log: BattleLogEntry[],
  ) => void;
  /** 보스 공격 시작 시 자동 사냥을 끄기 위한 콜백. */
  onStopHunting?: () => void;
  /** 타이머형 자동 사냥(원정) 진행 중 — true 면 공격 불가 (캐릭터가 자리에 없음). */
  dispatched?: boolean;
  /** 서버가 공격/처치 시 set 한 storyFlag 를 클라 상태에도 즉시 반영 (운향 진입로 등이 reload 없이 열리도록). */
  onStoryFlag?: (flagId: string) => void;
};

export function CoopBossCard({
  regionId,
  playerName,
  onPlayerHpChange,
  applyReward,
  notify,
  notifyBattle,
  onStopHunting,
  dispatched = false,
  onStoryFlag,
}: Props) {
  const { data, error, working, attack, claim } = useCoopBoss(regionId, true);
  const [now, setNow] = useState(() => Date.now());
  // 직전 claim 결과 — 보상 로그로 카드 밑에 노출. 같은 보스에서 재수령 불가라 1번만 표시.
  const [lastClaim, setLastClaim] = useState<{
    tier: CoopRewardTier;
    applied: AppliedCoopReward;
  } | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  if (!data) return null;
  if (!data.session) {
    // 세션 row 가 아예 없는 region — cron(매분) 이 곧 첫 spawn.
    return (
      <Card padding="md">
        <div className="text-xs uppercase tracking-wider text-rose-500/70 dark:text-rose-400/70">
          협동 보스
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          현재 등장한 협동 보스가 없습니다 — 곧 등장합니다.
        </p>
      </Card>
    );
  }

  const s = data.session;
  const bossDef = COOP_BOSSES[regionId as RegionId];
  const bossImage = MONSTERS[s.bossName]?.image;
  const my = data.myContribution;
  const top = data.top;
  const recentLogs = data.recentLogs ?? [];
  const hpPct = Math.max(0, Math.min(100, (s.hp / s.maxHp) * 100));
  const expiresMs = new Date(s.expiresAt).getTime() - now;
  // cron 이 매분 도므로 nextSpawnAt(=처치시점+respawnMs) 도달 후 1분 안에 spawn.
  const nextSpawnMs = s.nextSpawnAt
    ? Math.max(0, new Date(s.nextSpawnAt).getTime() - now)
    : 0;
  const cooldownMs = my?.cooldownEndsAt
    ? new Date(my.cooldownEndsAt).getTime() - now
    : 0;
  const onCooldown = cooldownMs > 0;
  const defeated = !!s.defeatedAt;
  const expired = !defeated && expiresMs <= 0;
  const canAttack = !defeated && !expired && !onCooldown && !working && !dispatched;

  // cron(매분) 이 곧 만료 처리하고 nextSpawnAt(=+respawnMs) 을 채운다.
  // 그 직전의 짧은 window 만 fallback 표기 — 추정 = expiresAt + respawnMs.
  const expiredEstimateMs =
    expired && bossDef
      ? Math.max(
          0,
          new Date(s.expiresAt).getTime() + bossDef.respawnMs - now,
        )
      : 0;

  const handleAttack = async () => {
    onStopHunting?.();
    const r = await attack(playerName);
    if (!r) return;
    onPlayerHpChange(r.finalPlayerHp);
    // 서버가 박은 storyFlag (참여=peak_giant_engaged 등) 를 클라 상태에 즉시 반영 —
    // reload 없이 운향 진입로가 열리도록.
    r.storyFlagsSet?.forEach((f) => onStoryFlag?.(f));
    // 라운드 1회의 결과를 최근 기록 → 전투 로그에 남긴다. 일반 사냥과 동일한 펼치기 UX.
    if (r.diedEarly) {
      notifyBattle?.(
        "battle_lose",
        `${s.bossName}의 일격에 쓰러졌다 — ${r.damageDealt.toLocaleString()} 데미지 누적.`,
        r.log,
      );
    } else {
      notifyBattle?.(
        "battle_win",
        `${s.bossName}에게 ${r.damageDealt.toLocaleString()} 데미지를 가했다.`,
        r.log,
      );
    }
    if (r.session.defeated) {
      notify?.("운봉의 거인이 쓰러졌다 — 보상을 수령할 수 있다.");
    }
  };

  const handleClaim = async () => {
    const r = await claim();
    if (!r) return;
    const applied = applyReward(r.reward);
    setLastClaim({ tier: r.tier, applied });
    notify?.(`${COOP_TIER_LABEL[r.tier]} 보상 수령 완료`);
  };

  return (
    <Card padding="md">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-rose-500 dark:text-rose-400">
          협동 보스
        </span>
        {defeated && (
          <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            처치됨
          </span>
        )}
        {expired && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            만료
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3">
        {bossImage && (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bossImage}
              alt={s.bossName}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {s.bossName}
        </h4>
      </div>

      {/* HP bar */}
      <div className="mt-2">
        <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
          <span>HP</span>
          <span>
            {s.hp.toLocaleString()} / {s.maxHp.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full bg-rose-500 transition-all"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      {/* status line */}
      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        {defeated
          ? s.nextSpawnAt
            ? `다음 등장까지 ${formatDuration(nextSpawnMs)}`
            : "처치됨"
          : expired
            ? bossDef
              ? `만료됨 — 다음 등장까지 약 ${formatDuration(expiredEstimateMs)}`
              : "만료됨 — 다음 등장 대기"
            : `잔여 ${formatDuration(expiresMs)} · 기여자 ${top.length}`}
      </p>

      {/* my contribution */}
      {my && my.damage > 0 && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-600 dark:text-zinc-300">
              내 기여{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {my.damage.toLocaleString()}
              </span>{" "}
              ({(my.ratio * 100).toFixed(1)}%)
            </span>
            <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {my.tier ? COOP_TIER_LABEL[my.tier] : "—"}
            </span>
          </div>
          <NextTierHint ratio={my.ratio} />
        </div>
      )}

      {/* action buttons */}
      <div className="mt-3 flex flex-col gap-2">
        {!defeated && !expired && (
          <button
            type="button"
            disabled={!canAttack}
            onClick={handleAttack}
            className="rounded-md border border-rose-700 bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dispatched
              ? "자동 사냥 중 — 도전 불가"
              : working
                ? "공격 중…"
                : onCooldown
                  ? `다음 공격 ${formatDuration(cooldownMs)} 후`
                  : "공격하기 (5분 쿨)"}
          </button>
        )}
        {defeated && my?.claimable && (
          <button
            type="button"
            disabled={working}
            onClick={handleClaim}
            className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working
              ? "수령 중…"
              : `보상 수령 (${my.tier ? COOP_TIER_LABEL[my.tier] : "—"})`}
          </button>
        )}
        {defeated && my?.claimedAt && !lastClaim && (
          <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">
            수령 완료 · {my.claimedTier ? COOP_TIER_LABEL[my.claimedTier] : ""}
          </p>
        )}
        {defeated && (!my || my.damage === 0) && (
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            기여 데미지 없음 — 다음 등장에 도전하세요.
          </p>
        )}
      </div>

      {/* 보상 로그 — 직전 claim 결과 (재료/제작서/칭호) 상세 표시. */}
      {lastClaim && (
        <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {COOP_TIER_LABEL[lastClaim.tier]} 보상 수령
          </div>
          <ul className="space-y-0.5 text-emerald-800 dark:text-emerald-200">
            {lastClaim.applied.materials.map((m) => (
              <li key={`m-${m.id}`} className="flex justify-between tabular-nums">
                <span>{m.name}</span>
                <span>×{m.count}</span>
              </li>
            ))}
            {lastClaim.applied.recipes.map((r) => (
              <li key={`r-${r.id}`}>📜 {r.name}</li>
            ))}
            {lastClaim.applied.title && (
              <li className="font-semibold">🏅 {lastClaim.applied.title.name}</li>
            )}
            {lastClaim.applied.materials.length === 0 &&
              lastClaim.applied.recipes.length === 0 &&
              !lastClaim.applied.title && (
                <li className="text-emerald-600/70 dark:text-emerald-400/70">
                  새로 들어온 항목 없음 (모두 보유 중이거나 굴림 실패).
                </li>
              )}
          </ul>
        </div>
      )}

      {/* 순위 보기 — 누적 데미지 상위 기여자. */}
      {top.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            순위 보기
          </summary>
          <ol className="mt-1 space-y-0.5">
            {top.map((row, i) => (
              <li
                key={`${row.name}-${i}`}
                className={`flex justify-between tabular-nums ${row.mine ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-200"}`}
              >
                <span>
                  {i + 1}. {row.name}
                </span>
                <span>{row.damage.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* 전투 로그 — 모든 참여자의 공격을 시간순으로, 펼치면 실제 BattleLogEntry 노출. */}
      {recentLogs.length > 0 && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            전투 로그
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recentLogs.map((row) => (
              <li
                key={row.id}
                className={`rounded border ${row.mine ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"}`}
              >
                <details>
                  <summary
                    className={`flex cursor-pointer list-none items-baseline justify-between gap-2 p-1.5 tabular-nums [&::-webkit-details-marker]:hidden ${row.mine ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}
                  >
                    <span className="min-w-0 truncate">
                      <span className={row.mine ? "font-semibold" : ""}>
                        {row.name}
                      </span>
                      {row.diedEarly && (
                        <span className="ml-1 text-rose-600 dark:text-rose-400">
                          (쓰러짐)
                        </span>
                      )}
                    </span>
                    <span className="shrink-0">
                      가한 데미지 {row.damageDealt.toLocaleString()}
                    </span>
                  </summary>
                  {row.log.length > 0 && (
                    <ul className="space-y-0.5 border-t border-zinc-200 px-1.5 py-1 pl-3.5 text-[11px] dark:border-zinc-800">
                      {row.log.map((entry, i) => (
                        <li
                          key={i}
                          className={
                            entry.kind === "phase_trigger"
                              ? "text-amber-700 dark:text-amber-400"
                              : entry.kind === "player_attack"
                                ? "text-zinc-700 dark:text-zinc-300"
                                : entry.kind === "enemy_attack"
                                  ? "text-rose-600/80 dark:text-rose-400/80"
                                  : "text-zinc-500 dark:text-zinc-400"
                          }
                        >
                          {entry.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </Card>
  );
}

function NextTierHint({ ratio }: { ratio: number }) {
  const order: CoopRewardTier[] = ["bronze", "silver", "gold", "epic", "legend"];
  const next = order.find((t) => ratio < COOP_TIER_THRESHOLDS[t]);
  if (!next) return null;
  const need = (COOP_TIER_THRESHOLDS[next] - ratio) * 100;
  return (
    <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
      다음 {COOP_TIER_LABEL[next]} 까지 +{need.toFixed(1)}%
    </p>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0초";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

