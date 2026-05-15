"use client";

import { Lock, Sparkle, Star } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import {
  STAT_CONVERSIONS,
  STAT_KEYS,
  STAT_LABELS,
  STAT_REVEAL_THRESHOLD,
  STAT_SKILL_INFO_THRESHOLD,
  STAT_TIER3_REVEAL_THRESHOLD,
  STAT_TIER4_REVEAL_THRESHOLD,
  STAT_TIER5_REVEAL_THRESHOLD,
  STAT_TIER6_REVEAL_THRESHOLD,
  type StatKey,
} from "@/adventure/data/stats";
import {
  FEAT_SKILL,
  FEAT_STAT_THRESHOLD,
  FEAT_TIER2_SKILL,
  FEAT_TIER2_STAT_THRESHOLD,
  STAT_SKILL,
  type FeatSkillInfo,
} from "@/adventure/character/skills";

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
          const tier4 = tiers[3];
          const tier5 = tiers[4];
          const tier6 = tiers[5];
          const tier1Revealed = value >= STAT_SKILL_INFO_THRESHOLD;
          const tier3Revealed = value >= STAT_TIER3_REVEAL_THRESHOLD;
          const tier4Revealed = value >= STAT_TIER4_REVEAL_THRESHOLD;
          const tier5Revealed = value >= STAT_TIER5_REVEAL_THRESHOLD;
          const tier6Revealed = value >= STAT_TIER6_REVEAL_THRESHOLD;
          // 1차 티어 발동 임계가 정보 공개 임계보다 높을 때 발동 안내.
          const showTier1ActivationNote =
            !!tier1 &&
            tier1Revealed &&
            tier1.activationThreshold > STAT_SKILL_INFO_THRESHOLD;
          // 2차 티어는 STAT_REVEAL_THRESHOLD(15) 도달 시 공개. (환산 정보는 항상 공개.)
          const tier2Revealed = !!tier2 && value >= STAT_REVEAL_THRESHOLD;
          const showTier2ActivationNote =
            !!tier2 &&
            tier2Revealed &&
            tier2.activationThreshold > STAT_REVEAL_THRESHOLD;
          const showTier3ActivationNote =
            !!tier3 &&
            tier3Revealed &&
            tier3.activationThreshold > STAT_TIER3_REVEAL_THRESHOLD;
          const showTier4ActivationNote =
            !!tier4 &&
            tier4Revealed &&
            tier4.activationThreshold > STAT_TIER4_REVEAL_THRESHOLD;
          const showTier5ActivationNote =
            !!tier5 &&
            tier5Revealed &&
            tier5.activationThreshold > STAT_TIER5_REVEAL_THRESHOLD;
          const showTier6ActivationNote =
            !!tier6 &&
            tier6Revealed &&
            tier6.activationThreshold > STAT_TIER6_REVEAL_THRESHOLD;
          // 다음 공개 — tier1 → tier2 → tier3 → tier4 → tier5 → tier6. (환산 정보는 항상 공개.)
          const nextRevealAt = !tier1Revealed
            ? STAT_SKILL_INFO_THRESHOLD
            : !tier2Revealed
              ? STAT_REVEAL_THRESHOLD
              : !tier3Revealed
                ? STAT_TIER3_REVEAL_THRESHOLD
                : !tier4Revealed
                  ? STAT_TIER4_REVEAL_THRESHOLD
                  : !tier5Revealed
                    ? STAT_TIER5_REVEAL_THRESHOLD
                    : !tier6Revealed
                      ? STAT_TIER6_REVEAL_THRESHOLD
                      : "—";
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

              {/* 환산 효과 — 항상 공개. */}
              <div className="mt-1.5 flex items-start gap-2 text-xs">
                <Sparkle
                  size={14}
                  weight="duotone"
                  className="shrink-0 text-amber-500 mt-0.5"
                />
                <span className="text-zinc-700 dark:text-zinc-200">
                  {STAT_CONVERSIONS[k]}
                </span>
              </div>

              {/* 2차 스킬 — STAT_REVEAL_THRESHOLD(15) 도달 시 공개. */}
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
                    tier2Revealed && (
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

              {/* 4차 스킬 — STAT_TIER4_REVEAL_THRESHOLD(45) 도달 시 공개. */}
              {tier4 && (
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  {tier4Revealed ? (
                    <>
                      <Sparkle
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-amber-500 mt-0.5"
                      />
                      <span className="text-zinc-700 dark:text-zinc-200">
                        <span className="font-medium">{tier4.name}</span> —{" "}
                        {tier4.description}
                        {showTier4ActivationNote && (
                          <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                            ({STAT_LABELS[k]} {tier4.activationThreshold}에서 발동)
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    tier3Revealed && (
                      <>
                        <Lock
                          size={14}
                          weight="duotone"
                          className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                        />
                        <span className="italic text-zinc-500 dark:text-zinc-400">
                          {STAT_TIER4_REVEAL_THRESHOLD} 달성 시 4차 스킬 공개
                        </span>
                      </>
                    )
                  )}
                </div>
              )}

              {/* 5차 스킬 — STAT_TIER5_REVEAL_THRESHOLD(60) 도달 시 공개. 만렙 확장 패키지. */}
              {tier5 && (
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  {tier5Revealed ? (
                    <>
                      <Sparkle
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-amber-500 mt-0.5"
                      />
                      <span className="text-zinc-700 dark:text-zinc-200">
                        <span className="font-medium">{tier5.name}</span> —{" "}
                        {tier5.description}
                        {showTier5ActivationNote && (
                          <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                            ({STAT_LABELS[k]} {tier5.activationThreshold}에서 발동)
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    tier4Revealed && (
                      <>
                        <Lock
                          size={14}
                          weight="duotone"
                          className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                        />
                        <span className="italic text-zinc-500 dark:text-zinc-400">
                          {STAT_TIER5_REVEAL_THRESHOLD} 달성 시 5차 스킬 공개
                        </span>
                      </>
                    )
                  )}
                </div>
              )}

              {/* 6차 스킬 — STAT_TIER6_REVEAL_THRESHOLD(80) 도달 시 공개. 만렙 확장 패키지. */}
              {tier6 && (
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  {tier6Revealed ? (
                    <>
                      <Sparkle
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-amber-500 mt-0.5"
                      />
                      <span className="text-zinc-700 dark:text-zinc-200">
                        <span className="font-medium">{tier6.name}</span> —{" "}
                        {tier6.description}
                        {showTier6ActivationNote && (
                          <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                            ({STAT_LABELS[k]} {tier6.activationThreshold}에서 발동)
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    tier5Revealed && (
                      <>
                        <Lock
                          size={14}
                          weight="duotone"
                          className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                        />
                        <span className="italic text-zinc-500 dark:text-zinc-400">
                          {STAT_TIER6_REVEAL_THRESHOLD} 달성 시 6차 스킬 공개
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

      {/* 특기 — 기본(임계 25) / 2티어(임계 50) 두 카탈로그. 같은 스탯쌍을 공유하며 동시 보유·장착 가능.
          공개 단계: 둘 다 미달 → ??? / 한쪽만 달성 → 이름 + 남은 스탯 조건 / 둘 다 → 전체 + 효과. */}
      <FeatSection
        title="특기"
        catalog={FEAT_SKILL}
        threshold={FEAT_STAT_THRESHOLD}
        stats={stats}
      />
      <FeatSection
        title="2티어 특기"
        catalog={FEAT_TIER2_SKILL}
        threshold={FEAT_TIER2_STAT_THRESHOLD}
        stats={stats}
      />
    </div>
  );
}

function FeatSection({
  title,
  catalog,
  threshold,
  stats,
}: {
  title: string;
  catalog: readonly FeatSkillInfo[];
  threshold: number;
  stats: Record<StatKey, number>;
}) {
  return (
    <Card as="section">
      <div className="mb-1.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}{" "}
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          (요구 스탯 둘 다 {threshold} 도달 시 보유 · 한쪽만 달성하면 이름·남은 조건 공개 · 특기 슬롯에 장착)
        </span>
      </div>
      <ul className="space-y-1.5">
        {catalog.map((f) => {
          const met = f.req.filter((s) => stats[s] >= threshold);
          const owned = met.length === f.req.length;
          const revealed = met.length >= 1;
          const remaining = f.req.find((s) => stats[s] < threshold);
          return (
            <li key={f.name} className="flex items-start gap-2 text-xs">
              {owned ? (
                <Star
                  size={14}
                  weight="fill"
                  className="shrink-0 text-violet-500 mt-0.5"
                />
              ) : (
                <Lock
                  size={14}
                  weight="duotone"
                  className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                />
              )}
              {owned ? (
                <span className="text-zinc-700 dark:text-zinc-200">
                  <span className="font-medium">{f.name}</span> — {f.description}
                  <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                    (
                    {f.req
                      .map((s) => `${STAT_LABELS[s]} ${threshold}`)
                      .join(" & ")}{" "}
                    · 보유 중)
                  </span>
                </span>
              ) : revealed && remaining ? (
                <span className="text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">
                    {f.name}
                  </span>
                  <span className="ml-1">
                    — 남은 해금 조건: {STAT_LABELS[remaining]} {threshold} (현재{" "}
                    {stats[remaining]})
                  </span>
                </span>
              ) : (
                <span className="italic text-zinc-400 dark:text-zinc-500">
                  ??? — 요구 스탯 중 하나가 {threshold} 도달 시 공개
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
