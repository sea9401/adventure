import type { MaterialKind } from "./primitives";
import type { EquipmentId } from "./equipment";

export type CodexStatKey = "hp" | "str" | "vit" | "mdef" | "spd" | "agi" | "matk";

export type CodexState = {
  materials: MaterialKind[];
  equipment: EquipmentId[];
  allocated: Partial<Record<CodexStatKey, number>>;
};
