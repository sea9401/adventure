import type { Resources, Materials } from "./primitives";
import type { SkillId, ElementKind } from "./skills";
import type { EquipmentId } from "./equipment";
import type { Treasure } from "./regions";
import type { ArenaTier } from "./arena";

export type DispatchLogEntry = {
  turn: number;
  text: string;
  playerHpAfter: number;
  // 원소술사 — 해당 턴 종료 시점의 스택 / 잔존 (24 plan, 인디케이터 표시용)
  elements?: ElementKind[];
  elementLingerTurns?: number;
};

export type BossCombatLogEntry = {
  turn: number;
  text: string;
  playerEvents?: string[];
  enemyEvents?: string[];
  playerHpAfter: number;
  bossHpAfter: number;
  elements?: ElementKind[];
  elementLingerTurns?: number;
};

export type BossDispatchResult = {
  className: string;
  bossName: string;
  defeated: boolean;
  diedEarly: boolean;
  totalTurns: number;
  damageDealt: number;
  damageTaken: number;
  dodgesByPlayer: number;
  dodgesByEnemy: number;
  skillActivations: Partial<Record<SkillId, number>>;
  finalHp: number;
  gained: Partial<Resources>;
  exp: number;
  droppedMaterials: Materials;
  droppedUniqueEquipment?: EquipmentId;
  log: BossCombatLogEntry[];
  maxSingleHit: number;
};

export type DispatchResult = {
  className: string;
  durationSec: number;
  kills: { name: string; count: number }[];
  totalKills: number;
  totalTurns: number;
  damageDealt: number;
  damageTaken: number;
  dodgesByPlayer: number;
  dodgesByEnemy: number;
  skillActivations: Partial<Record<SkillId, number>>;
  finalHp: number;
  diedEarly: boolean;
  gained: Partial<Resources>;
  exp: number;
  droppedMaterials: Materials;
  treasure: Treasure | null;
  treasureHits: number;
  treasureRolls: number[];
  // 취소 시 부분 보상 계산용 — finalMult/treasure 적용 전, 적 처치만으로 누적된 raw 값
  killsGoldRaw: number;
  killsIronRaw: number;
  killsExpRaw: number;
  killsMaterialsRaw: Materials;
  // 분당 HP 스냅샷 (turn 60, 120, ..., 마지막 ≤ totalTurns) — 취소 시 finalHp 보간용
  hpAtMinute: number[];
  log: DispatchLogEntry[];
  maxSingleHit: number;
};

export type Dispatch = {
  regionId: string;
  startedAt: number;
  endsAt: number;
  durationSec: number;
  isBoss?: boolean;
  bossResult?: BossDispatchResult;
  dispatchResult?: DispatchResult;
} | null;

export type LastBattle =
  | {
      at: number;
      kind: "field";
      regionName: string;
      characterMaxHp: number;
      result: DispatchResult;
    }
  | {
      at: number;
      kind: "boss";
      regionName: string;
      bossName: string;
      bossMaxHp: number;
      characterMaxHp: number;
      result: BossDispatchResult;
    }
  | {
      at: number;
      kind: "coop";
      bossName: string;
      bossMaxHp: number;
      characterMaxHp: number;
      log: BossCombatLogEntry[];
      damageDealt: number;
      damageTaken: number;
      diedEarly: boolean;
    }
  | {
      at: number;
      kind: "arena";
      opponentNickname: string;
      opponentClassName: string;
      opponentLevel: number;
      opponentMaxHp: number;
      bossMaxHp: number;
      characterMaxHp: number;
      tier: ArenaTier;
      result: BossDispatchResult;
    };

export type LogEntry = {
  at: number;
  regionName: string;
  className: string;
  durationSec: number;
  kills: { name: string; count: number }[];
  totalKills: number;
  damageDealt: number;
  damageTaken: number;
  dodgesByPlayer: number;
  dodgesByEnemy: number;
  skillActivations: Partial<Record<SkillId, number>>;
  diedEarly: boolean;
  gained: Partial<Resources>;
  exp: number;
  droppedMaterials: Materials;
  droppedUniqueEquipment?: EquipmentId;
  treasure: Treasure | null;
  treasureHits?: number;
  earlyExit?: "cancel";
  isBoss?: boolean;
  bossName?: string;
  bossDefeated?: boolean;
  report: string;
};
