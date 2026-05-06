import type { Resources, Materials } from "./primitives";
import type { CharacterClass } from "./classes";
import type { Character } from "./character";
import type { EquipmentId } from "./equipment";
import type { CraftableId } from "./crafting";
import type { Estate, Guild } from "./estate";
import type { Dispatch, LogEntry, LastBattle } from "./dispatch";
import type { AchievementId } from "./achievements";

// === 알림 센터 (notification bell) ===
export type NotificationType = "unique_drop" | "milestone" | "boss_kill" | "info";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  at: number; // ms epoch
  read: boolean;
  // 페이로드 (선택) — 종류별
  equipmentId?: EquipmentId;
  bossName?: string;
  level?: number;
};

export type GameStats = {
  totalKills: number;
  totalBossKills: number;
  totalCoopBossDefeats: number;
  totalGoldEarned: number;
  totalIronEarned: number;
  totalDispatches: number;
  totalAlchemyCrafted: number;
  totalEquipmentCrafted: number;
  classesUsed: CharacterClass[];
  bossDefeatedNames: string[];
  bossKillCounts: Partial<Record<string, number>>;
  highestLevel: number;
  totalDeaths: number;
  totalDodges: number;
  totalDamageTaken: number;
  totalDamageDealt?: number;
  maxSingleHit: number;
  // 보스별 누적 클리어 턴 + 횟수 — 평균 클리어 턴 산출용
  bossClearStats?: Partial<Record<string, { totalTurns: number; clears: number }>>;
};

export type GameState = {
  character: Character;
  resources: Resources;
  materials: Materials;
  crafted: Partial<Record<CraftableId, number>>;
  equipmentInventory: Partial<Record<EquipmentId, number>>;
  estate: Estate;
  guild: Guild;
  dispatch: Dispatch;
  log: LogEntry[];
  hpUpdatedAt: number;
  bossCooldowns: Partial<Record<string, number>>;
  lastSeenAt: number;
  stats: GameStats;
  achievements: AchievementId[]; // 단일 티어 업적 (claimed)
  claimedTiers: Partial<Record<AchievementId, number>>; // 티어 업적별 claimed 티어 수
  tutorialDismissed: boolean; // 시작 가이드 영구 숨김 여부
  welcomeShown?: boolean; // 첫 진입 환영 모달 노출 여부
  combatLogEnabled: boolean; // 실시간 전투 로그 표시 ON/OFF
  theme?: "dark" | "light"; // 테마 (기본 dark)
  lastBattles?: LastBattle[]; // 최근 전투 기록 (최대 3개, 최신순)
  lastCoopBattles?: LastBattle[]; // 최근 코옵 전투 기록 (최대 3개, 최신순)
  notifications?: Notification[]; // 알림 센터 (최신순, 최대 50개)
  // 모험 탭 — 마을 시스템 (adventure-v1)
  currentTownId?: string; // 현재 머무는 마을 id (TownId)
  unlockedTownIds?: string[]; // 해금된 마을 id 목록 (TownId[])
};
