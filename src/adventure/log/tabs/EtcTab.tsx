"use client";

import { Lock, Sparkle } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import {
  STAT_CONVERSIONS,
  STAT_KEYS,
  STAT_LABELS,
  STAT_REVEAL_THRESHOLD,
  STAT_SKILL_INFO_THRESHOLD,
  STAT_TIER3_REVEAL_THRESHOLD,
  type StatKey,
} from "@/adventure/data/stats";
import { STAT_SKILL } from "@/adventure/character/skills";

export function EtcTab({ stats }: { stats: Record<StatKey, number> }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {STAT_KEYS.map((k) => {
          const value = stats[k];
          const tiers = STAT_SKILL[k];
          const tier1 = tiers[0];
          const tier2 = tiers[1];
          const tier3 = tiers[2];
          const tier1Revealed = value >= STAT_SKILL_INFO_THRESHOLD;
          const conversionRevealed = value >= STAT_REVEAL_THRESHOLD;
          const tier3Revealed = value >= STAT_TIER3_REVEAL_THRESHOLD;
          // 1차 티어 발동 임계가 정보 공개 임계보다 높을 때 발동 안내.
          const showTier1ActivationNote =
            !!tier1 &&
            tier1Revealed &&
            tier1.activationThreshold > STAT_SKILL_INFO_THRESHOLD;
          // 2차 티어는 환산 공개와 동시 (15) 에 노출.
          const tier2Revealed = !!tier2 && conversionRevealed;
          // 2차 티어 발동 안내 — 정보 공개 (15) 와 발동 임계 (20/30) 차이가 있어 항상 표시.
          const showTier2ActivationNote =
            !!tier2 &&
            tier2Revealed &&
            tier2.activationThreshold > STAT_REVEAL_THRESHOLD;
          // 3차 티어 발동 안내 — 정보 공개 (30) 와 발동 임계 (35) 차이.
          const showTier3ActivationNote =
            !!tier3 &&
            tier3Revealed &&
            tier3.activationThreshold > STAT_TIER3_REVEAL_THRESHOLD;
          // 다음 공개 — tier1 → 환산+tier2 → tier3.
          const nextRevealAt = tier1Revealed
            ? conversionRevealed
              ? tier3Revealed
                ? "—"
                : STAT_TIER3_REVEAL_THRESHOLD
              : STAT_REVEAL_THRESHOLD
            : STAT_SKILL_INFO_THRESHOLD;
          return (
            <Card as="li" key={k}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {STAT_LABELS[k]}
                </span>
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  현재 {value} / 다음 공개 {nextRevealAt}
                </span>
              </div>

              {/* 1차 스킬 — STAT_SKILL_INFO_THRESHOLD(5) 도달 시 공개. */}
              {tier1 && (
                <div className="mt-2 flex items-start gap-2 text-xs">
                  {tier1Revealed ? (
                    <>
                      <Sparkle
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-amber-500 mt-0.5"
                      />
                      <span className="text-zinc-700 dark:text-zinc-200">
                        <span className="font-medium">{tier1.name}</span> —{" "}
                        {tier1.description}
                        {showTier1ActivationNote && (
                          <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                            ({STAT_LABELS[k]} {tier1.activationThreshold}에서
                            발동)
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                      />
                      <span className="italic text-zinc-500 dark:text-zinc-400">
                        {STAT_SKILL_INFO_THRESHOLD} 달성 시 스킬 정보 공개
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* 환산 효과 + 2차 스킬 — STAT_REVEAL_THRESHOLD(15) 도달 시 공개. */}
              <div className="mt-1.5 flex items-start gap-2 text-xs">
                {conversionRevealed ? (
                  <>
                    <Sparkle
                      size={14}
                      weight="duotone"
                      className="shrink-0 text-amber-500 mt-0.5"
                    />
                    <span className="text-zinc-700 dark:text-zinc-200">
                      {STAT_CONVERSIONS[k]}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock
                      size={14}
                      weight="duotone"
                      className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                    />
                    <span className="italic text-zinc-500 dark:text-zinc-400">
                      {STAT_REVEAL_THRESHOLD} 달성 시 효과 정보 공개
                    </span>
                  </>
                )}
              </div>

              {/* 2차 스킬 — 환산과 같은 타이밍에 공개. */}
              {tier2 && tier2Revealed && (
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  <Sparkle
                    size={14}
                    weight="duotone"
                    className="shrink-0 text-amber-500 mt-0.5"
                  />
                  <span className="text-zinc-700 dark:text-zinc-200">
                    <span className="font-medium">{tier2.name}</span> —{" "}
                    {tier2.description}
                    {showTier2ActivationNote && (
                      <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                        ({STAT_LABELS[k]} {tier2.activationThreshold}에서 발동)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* 3차 스킬 — STAT_TIER3_REVEAL_THRESHOLD(30) 도달 시 공개. */}
              {tier3 && (
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  {tier3Revealed ? (
                    <>
                      <Sparkle
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-amber-500 mt-0.5"
                      />
                      <span className="text-zinc-700 dark:text-zinc-200">
                        <span className="font-medium">{tier3.name}</span> —{" "}
                        {tier3.description}
                        {showTier3ActivationNote && (
                          <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                            ({STAT_LABELS[k]} {tier3.activationThreshold}에서 발동)
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    conversionRevealed && (
                      <>
                        <Lock
                          size={14}
                          weight="duotone"
                          className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                        />
                        <span className="italic text-zinc-500 dark:text-zinc-400">
                          {STAT_TIER3_REVEAL_THRESHOLD} 달성 시 3차 스킬 공개
                        </span>
                      </>
                    )
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
