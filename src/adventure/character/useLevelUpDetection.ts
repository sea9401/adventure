"use client";

import { useEffect, useRef, useState } from "react";
import type { Skill } from "./types";

// 레벨업 + 신규 스킬 획득을 감지하는 effect 묶음.
//
// SaveProvider 가 마운트 전에 character.v1 을 hydrate 하므로 첫 effect 의 level/skills 는
// 이미 저장된 값. ref 로 baseline 을 잡고, 이후 변경분만 알림으로 처리.
//
// levelUpTrigger 는 LevelUpOverlay 의 triggerKey 로 그대로 전달 — 매 레벨업마다 +1.
export function useLevelUpDetection(opts: {
  level: number;
  characterSkills: Skill[];
  addPoints: (n: number) => void;
  addNotification: (kind: "milestone", text: string) => void;
}) {
  const lastSeenLevelRef = useRef<number | null>(null);
  const lastSeenSkillsRef = useRef<string[] | null>(null);
  const [levelUpTrigger, setLevelUpTrigger] = useState(0);

  // 레벨업 감지 — level 증가 시 스탯 포인트 지급 + 알림 + 오버레이.
  useEffect(() => {
    if (lastSeenLevelRef.current === null) {
      lastSeenLevelRef.current = opts.level;
      return;
    }
    const prev = lastSeenLevelRef.current;
    const next = opts.level;
    if (next > prev) {
      const gained = next - prev;
      opts.addPoints(gained);
      opts.addNotification(
        "milestone",
        `레벨업! Lv.${next} (스탯 포인트 +${gained})`,
      );
      setLevelUpTrigger((v) => v + 1);
    }
    lastSeenLevelRef.current = next;
    // addNotification / addPoints 는 setter — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.level]);

  // 스킬 획득 감지 — 스탯 변화로 새 스킬이 추가되면 알림.
  const skillNamesKey = opts.characterSkills.map((s) => s.name).join(",");
  useEffect(() => {
    const currentNames = opts.characterSkills.map((s) => s.name);
    if (lastSeenSkillsRef.current === null) {
      lastSeenSkillsRef.current = currentNames;
      return;
    }
    const prev = new Set(lastSeenSkillsRef.current);
    for (const name of currentNames) {
      if (!prev.has(name)) {
        opts.addNotification("milestone", `스킬 획득! ${name}`);
      }
    }
    lastSeenSkillsRef.current = currentNames;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillNamesKey]);

  return { levelUpTrigger };
}
