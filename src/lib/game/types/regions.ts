import type { ResourceKind, Materials } from "./primitives";
import type { Enemy, Boss } from "./enemies";

export type Treasure = {
  name: string;
  chance: number;
  gold?: number;
  iron?: number;
  materials?: Materials;
};

export type RegionGroup = "outskirts" | "wilderness" | "pirate_isles" | "abyss";

export type Region = {
  id: string;
  name: string;
  group: RegionGroup;
  durationMs: number;
  drops: Partial<Record<ResourceKind, [number, number]>>;
  expReward: number;
  flavor: string;
  enemies: Enemy[];
  treasure?: Treasure;
  boss?: Boss;
};
