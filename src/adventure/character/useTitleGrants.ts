"use client";

import { useEffect } from "react";
import { COUNTER_TITLES } from "../data/titles";
import { STAT_KEYS, type StatKey } from "../data/stats";

// 외부 상태 관찰만 하는 passive 칭호 등록 effect 묶음.
// grantTitle 은 호출자가 보유 — handleSell/onBattleEnd/completeQuest 등 능동 경로와
// 공유돼야 하므로 페이지가 가지고 있고, 이 훅은 카운터/상태/시간 기반 자동 부여만 담당.
export function useTitleGrants(
  grantTitle: (id: string) => void,
  opts: {
    battleLosses: number;
    trainingCount: number;
    chatCount: number;
    healingCount: number;
    gold: number;
    level: number;
    /** 한 NPC 와의 최대 대화 횟수 — 100 이상이면 '낚시꾼' 칭호. */
    maxNpcTalkCount: number;
    /** equip + training 합산된 최종 스탯. */
    totalStats: Record<StatKey, number>;
  },
) {
  // 카운터형 칭호 — COUNTER_TITLES 표를 한 번에 돌며 임계값 도달분 등록.
  useEffect(() => {
    const counters: Record<string, number> = {
      battleLosses: opts.battleLosses,
      trainingCount: opts.trainingCount,
      chatCount: opts.chatCount,
      healingCount: opts.healingCount,
    };
    for (const t of COUNTER_TITLES) {
      if ((counters[t.key] ?? 0) >= t.target) grantTitle(t.id);
    }
    // grantTitle 안정 참조 — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts.battleLosses,
    opts.trainingCount,
    opts.chatCount,
    opts.healingCount,
  ]);

  // 새벽 3~5시 접속 → '새벽반' 칭호 자동 등록. 마운트 시 1회 평가.
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 3 && hour < 5) grantTitle("early_bird");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상태 관찰형 — gold 0 도달, 동일 NPC 100회 대화, 외골수 빌드, 레벨/골드 마일스톤.
  // 외골수: 한 스탯 30↑, 나머지 모두 10↓ (11~29 구간이 있으면 미부여).
  const goldZero = opts.gold === 0;
  const goldRich = opts.gold >= 10000;
  const levelVeteran = opts.level >= 30;
  const levelLegend = opts.level >= 50;
  const levelMythic = opts.level >= 70;
  useEffect(() => {
    if (goldZero) grantTitle("beggar");
    if (goldRich) grantTitle("wealthy");
    if (levelVeteran) grantTitle("level_30");
    if (levelLegend) grantTitle("level_50");
    if (levelMythic) grantTitle("level_70");
    if (opts.maxNpcTalkCount >= 100) grantTitle("phisher");
    const high = STAT_KEYS.filter((k) => opts.totalStats[k] >= 30).length;
    const low = STAT_KEYS.filter((k) => opts.totalStats[k] <= 10).length;
    if (high === 1 && low === STAT_KEYS.length - 1) grantTitle("one_track");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    goldZero,
    goldRich,
    levelVeteran,
    levelLegend,
    levelMythic,
    opts.maxNpcTalkCount,
    opts.totalStats.str,
    opts.totalStats.dex,
    opts.totalStats.vit,
    opts.totalStats.spd,
    opts.totalStats.luk,
  ]);
}
