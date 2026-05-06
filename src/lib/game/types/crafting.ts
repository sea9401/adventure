import type { Materials, MaterialKind } from "./primitives";

export type CraftableId = "summon_san_gun" | "summon_griffon" | "summon_kraken";

export type CraftableDef = {
  id: CraftableId;
  name: string;
  cost: Materials;
  output?: { material: MaterialKind; count: number };
  flavor: string;
};
