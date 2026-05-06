// 모험 탭 — 마을 5개. 각 마을은 시그니처 던전 (REGIONS의 region.id) 1개와 매핑된다.
// 해금: 첫 번째는 always, 나머지는 캐릭터 레벨 도달 (보스 시스템 활성화 전 임시 조건).
// 보스 처치 조건도 미리 정의 — 추후 보스 도전 UI 추가 시 OR 로 묶어 자동 해금.

export type TownId = "plains" | "woodland" | "highland" | "ruins_town" | "dunes";

export type UnlockCondition =
  | { kind: "always" }
  | { kind: "level"; level: number }
  | { kind: "boss_kill"; regionId: string; count: number };

export interface Town {
  id: TownId;
  name: string;
  flavor: string;
  /** REGIONS의 region.id — 시그니처 던전 매핑 */
  dungeonId: string;
  unlock: UnlockCondition;
  /** 미니맵 좌표 (옵션 B용, 0..100 %) */
  pos: { x: number; y: number };
}

export const TOWNS: Town[] = [
  {
    id: "plains",
    name: "평원 마을",
    flavor: "평야 옆에 세워진 가장 평범한 마을. 모든 모험은 여기서 시작된다.",
    dungeonId: "plains",
    unlock: { kind: "always" },
    pos: { x: 50, y: 60 },
  },
  {
    id: "woodland",
    name: "숲속 마을",
    flavor: "사냥꾼과 약초꾼이 모여 사는 마을. 외곽 숲의 들개와 산적이 길을 막는다.",
    dungeonId: "forest",
    unlock: { kind: "level", level: 5 },
    pos: { x: 25, y: 40 },
  },
  {
    id: "highland",
    name: "산기슭 마을",
    flavor: "광부와 대장장이의 마을. 동굴 깊은 곳에서 무언가가 부스럭거린다.",
    dungeonId: "mine",
    unlock: { kind: "level", level: 15 },
    pos: { x: 75, y: 40 },
  },
  {
    id: "ruins_town",
    name: "유적의 마을",
    flavor: "허물어진 옛 사원 옆에 자리잡은 학자들의 마을. 폐허엔 잠든 가디언이 있다.",
    dungeonId: "ruins",
    unlock: { kind: "level", level: 30 },
    pos: { x: 25, y: 20 },
  },
  {
    id: "dunes",
    name: "사막 변두리",
    flavor: "끝없는 모래바다와 맞닿은 위험한 마을. 도적과 독전갈이 오가는 길목.",
    dungeonId: "desert",
    unlock: { kind: "level", level: 60 },
    pos: { x: 75, y: 20 },
  },
];

export function findTown(id: string | undefined): Town | undefined {
  if (!id) return undefined;
  return TOWNS.find((t) => t.id === id);
}

export const DEFAULT_TOWN_ID: TownId = "plains";

export function isTownUnlocked(
  town: Town,
  ctx: { level: number; bossKillCounts: Partial<Record<string, number>> },
): boolean {
  switch (town.unlock.kind) {
    case "always":
      return true;
    case "level":
      return ctx.level >= town.unlock.level;
    case "boss_kill": {
      // boss는 region 보스 이름으로 카운트되지만, 임시로 region.id 기준도 허용 가능.
      // 현재는 level 기반만 사용 — boss_kill은 추후 활성화.
      const count = ctx.bossKillCounts[town.unlock.regionId] ?? 0;
      return count >= town.unlock.count;
    }
  }
}

export function unlockConditionLabel(town: Town): string {
  switch (town.unlock.kind) {
    case "always":
      return "";
    case "level":
      return `Lv.${town.unlock.level} 필요`;
    case "boss_kill":
      return `${town.unlock.regionId} 보스 ${town.unlock.count}회 처치`;
  }
}

export function computeUnlockedTownIds(ctx: {
  level: number;
  bossKillCounts: Partial<Record<string, number>>;
}): TownId[] {
  return TOWNS.filter((t) => isTownUnlocked(t, ctx)).map((t) => t.id);
}
