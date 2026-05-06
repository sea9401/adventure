"use client";

import { Panel } from "@/components/ui/Panel";
import { Row } from "@/components/ui/Row";
import { Tooltip } from "@/components/ui/Tooltip";
import { CLASSES } from "@/lib/game/data";
import {
  computeStats,
  getActivePassive,
  getEquipmentCritBonus,
  getEquippedSkills,
  getMonumentBonus,
  playerAgiCritChance,
  playerDodgeChance,
} from "@/lib/game/logic";
import { useGame } from "@/lib/game/store";
import { fmtStat } from "@/lib/equipment-ui";

type AllocStat = "str" | "vit" | "agi" | "int";

function AllocatableRow({
  label,
  value,
  title,
  stat,
  allocated,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: {
  label: string;
  value: string;
  title?: string;
  stat: AllocStat;
  allocated: number;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  void stat;
  return (
    <div className="flex items-center justify-between text-sm">
      {title ? (
        <Tooltip content={title}>
          <span className="text-fg-faint underline decoration-dotted decoration-fg-dim underline-offset-2">
            {label}
          </span>
        </Tooltip>
      ) : (
        <span className="text-fg-faint">{label}</span>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-fg font-medium tabular-nums">{value}</span>
        {allocated > 0 && (
          <span className="text-[10px] text-emerald-400 tabular-nums">+{allocated}</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="w-5 h-5 inline-flex items-center justify-center rounded text-xs border border-line text-fg-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`${label} -1`}
          title="분배 회수"
        >
          −
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="w-5 h-5 inline-flex items-center justify-center rounded text-xs border border-line text-fg-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`${label} +1`}
          title="분배"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CharacterView() {
  const state = useGame();
  const cls = CLASSES[state.character.currentClass];
  const monBonus = getMonumentBonus(state.estate.monument, state.stats.bossKillCounts);
  const stats = computeStats(state.character, monBonus);
  const passive = getActivePassive(state.character);

  // 정체성 자원 변환 계수
  const strMult = cls.strToAtkMult ?? 1;
  const vitDefMult = cls.vitToDefMult ?? 1;
  const vitHpFactor = cls.vitToHp ?? 0;
  const matkMult = cls.matkToIntMult ?? 1;
  const agiDodgeMult = cls.agiDodgeMult ?? 1;
  const agiCritMult = cls.agiCritMult ?? 1;
  const strContrib = stats.str * strMult;
  const vitDefContrib = stats.vit * vitDefMult;
  const vitHpContrib = stats.vit * vitHpFactor;
  const matkContrib = stats.matk * matkMult;
  const strSuffix = strMult !== 1 ? ` × ${strMult}` : "";
  const vitDefSuffix = vitDefMult !== 1 ? ` × ${vitDefMult}` : "";
  const matkSuffix = matkMult !== 1 ? ` × ${matkMult}` : "";

  // CRI 분해
  const passiveCrit = passive.kind === "crit" ? passive.chance : 0;
  const critMult = passive.kind === "crit" ? passive.mult : 2;
  let skillCritBoost = 0;
  for (const s of getEquippedSkills(state.character)) {
    if (s.trigger.kind === "passive" && s.effect.kind === "crit_chance_boost") {
      skillCritBoost += s.effect.chance;
    }
  }
  const agiCrit = playerAgiCritChance(cls, stats.agi);
  const eqCrit = getEquipmentCritBonus(state.character.equipped);
  const totalCrit = Math.min(1, passiveCrit + skillCritBoost + agiCrit + eqCrit);
  const critBreakdown: string[] = [];
  if (passiveCrit > 0) critBreakdown.push(`패시브 ${(passiveCrit * 100).toFixed(0)}%`);
  if (skillCritBoost > 0) critBreakdown.push(`스킬 +${(skillCritBoost * 100).toFixed(0)}%`);
  if (agiCrit > 0) critBreakdown.push(`AGI +${(agiCrit * 100).toFixed(0)}%`);
  if (eqCrit > 0) critBreakdown.push(`장비 +${(eqCrit * 100).toFixed(1)}%`);

  return (
    <>
      <Panel title="능력치">
        {(() => {
          const points = state.character.statPoints ?? 0;
          const allocated = state.character.allocatedStats ?? {
            str: 0,
            vit: 0,
            agi: 0,
            int: 0,
          };
          const inCombat = !!state.dispatch;
          const canAdd = points > 0 && !inCombat;
          return (
            <>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-fg-faint">분배 가능 포인트</span>
                <span
                  className={
                    points > 0 ? "text-emerald-400 font-medium" : "text-fg-dim font-medium"
                  }
                >
                  {points}
                </span>
              </div>
              <Row
                label="ATK"
                value={fmtStat(stats.atk)}
                title={`물리 공격력 (STR ${fmtStat(stats.str)}${strSuffix} = +${fmtStat(strContrib)} 포함)`}
              />
              <Row
                label="MATK"
                value={fmtStat(stats.int)}
                title={`마법 공격력 (MATK ${fmtStat(stats.matk)}${matkSuffix} = +${fmtStat(matkContrib)} 포함, INT 합산)`}
              />
              <Row
                label="DEF"
                value={fmtStat(stats.def)}
                title={`물리 방어력 (VIT ${fmtStat(stats.vit)}${vitDefSuffix} = +${fmtStat(vitDefContrib)} 포함)`}
              />
              <Row label="MDEF" value={fmtStat(stats.mdef)} title="마법 데미지 감소" />
              <div className="border-t border-line my-2" />
              <AllocatableRow
                label="STR"
                value={fmtStat(stats.str)}
                title={
                  strMult !== 1
                    ? `정체성 자원 — ATK에 ×${strMult} 환산 (+${fmtStat(strContrib)})`
                    : "primary attribute — ATK에 ×1 환산"
                }
                stat="str"
                allocated={allocated.str ?? 0}
                canAdd={canAdd}
                canRemove={(allocated.str ?? 0) > 0 && !inCombat}
                onAdd={() => state.allocateStat("str")}
                onRemove={() => state.deallocateStat("str")}
              />
              <AllocatableRow
                label="AGI"
                value={fmtStat(stats.agi)}
                title={`회피 ${(playerDodgeChance(cls, stats.agi) * 100).toFixed(0)}% · 크리 +${(playerAgiCritChance(cls, stats.agi) * 100).toFixed(0)}%${
                  agiDodgeMult !== 1 || agiCritMult !== 1 ? ` (정체성 ×${agiDodgeMult})` : ""
                }`}
                stat="agi"
                allocated={allocated.agi ?? 0}
                canAdd={canAdd}
                canRemove={(allocated.agi ?? 0) > 0 && !inCombat}
                onAdd={() => state.allocateStat("agi")}
                onRemove={() => state.deallocateStat("agi")}
              />
              <AllocatableRow
                label="INT"
                value={fmtStat(stats.int - stats.matk * matkMult)}
                title="primary attribute — DOT/마법 스킬 스케일링"
                stat="int"
                allocated={allocated.int ?? 0}
                canAdd={canAdd}
                canRemove={(allocated.int ?? 0) > 0 && !inCombat}
                onAdd={() => state.allocateStat("int")}
                onRemove={() => state.deallocateStat("int")}
              />
              <AllocatableRow
                label="VIT"
                value={fmtStat(stats.vit)}
                title={
                  vitDefMult !== 1 || vitHpFactor > 0
                    ? `정체성 자원 — DEF에 ×${vitDefMult} (+${fmtStat(vitDefContrib)})${vitHpFactor > 0 ? ` · HP에 +${vitHpFactor}/VIT (+${fmtStat(vitHpContrib)})` : ""}`
                    : "primary attribute — DEF에 ×1 환산"
                }
                stat="vit"
                allocated={allocated.vit ?? 0}
                canAdd={canAdd}
                canRemove={(allocated.vit ?? 0) > 0 && !inCombat}
                onAdd={() => state.allocateStat("vit")}
                onRemove={() => state.deallocateStat("vit")}
              />
              <Row
                label="CRI"
                value={`${(totalCrit * 100).toFixed(0)}% (×${critMult})`}
                title={critBreakdown.length > 0 ? critBreakdown.join(" · ") : "크리티컬 없음"}
              />
              <Row
                label="SPD"
                value={fmtStat(stats.spd)}
                title={`추가공격 확률 +${(stats.spd * 5).toFixed(0)}%`}
              />
              <p className="text-[10px] text-fg-dim mt-2">
                회수는 현재 무료입니다. 추후 자원 소모로 전환될 예정.
              </p>
            </>
          );
        })()}
      </Panel>

      <Panel title="자원">
        <Row label="골드" value={Math.floor(state.resources.gold).toLocaleString()} />
      </Panel>
    </>
  );
}
