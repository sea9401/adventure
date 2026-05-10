"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  COOP_BOSSES,
  COOP_TIER_LABEL,
  COOP_TIER_THRESHOLDS,
  type CoopRewardTier,
} from "./data";
import { useCoopBoss, type CoopAttackResponse, type CoopClaimResponse } from "./useCoopBoss";
import type { MaterialId } from "@/adventure/data/materials";
import { MATERIALS } from "@/adventure/data/materials";
import { getRecipeById } from "@/adventure/data/recipes";
import { TITLES } from "@/adventure/data/titles";
import type { RegionId } from "@/adventure/data/world";

type Props = {
  regionId: string;
  playerName: string;
  /** 공격 직후 캐릭터 hp 갱신. 서버가 derive 한 hp 를 그대로 반영. */
  onPlayerHpChange: (hp: number) => void;
  /** claim 보상 적용 — 재료/제작서/칭호. */
  applyReward: (reward: CoopClaimResponse["reward"]) => void;
  /** 토스트 등 알림. */
  notify?: (text: string) => void;
};

export function CoopBossCard({
  regionId,
  playerName,
  onPlayerHpChange,
  applyReward,
  notify,
}: Props) {
  const { data, error, working, attack, claim } = useCoopBoss(regionId, true);
  const [lastAttack, setLastAttack] = useState<CoopAttackResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
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
  const my = data.myContribution;
  const top = data.top;
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
  const canAttack = !defeated && !expired && !onCooldown && !working;

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
    setLastAttack(null);
    const r = await attack(playerName);
    if (!r) return;
    setLastAttack(r);
    onPlayerHpChange(r.finalPlayerHp);
    if (r.session.defeated) {
      notify?.("운봉의 거인이 쓰러졌다 — 보상을 수령할 수 있다.");
    }
  };

  const handleClaim = async () => {
    const r = await claim();
    if (!r) return;
    applyReward(r.reward);
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
      <h4 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {s.bossName}
      </h4>

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
            {working
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
        {defeated && my?.claimedAt && (
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

      {/* attack result */}
      {lastAttack && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex justify-between gap-2 tabular-nums">
            <span>가한 피해 +{lastAttack.damageDealt.toLocaleString()}</span>
            <span className="text-rose-600 dark:text-rose-400">
              받은 피해 −{lastAttack.damageTaken.toLocaleString()}
            </span>
          </div>
          {lastAttack.diedEarly && (
            <p className="mt-1 text-rose-600 dark:text-rose-400">
              쓰러짐 — 마을로 회귀 후 회복 필요
            </p>
          )}
        </div>
      )}

      {/* top contributors */}
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

// 사용되지 않지만 추후 reward 표시 확장용 — silence unused.
void MATERIALS;
void getRecipeById;
void TITLES;
