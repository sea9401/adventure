import type { Materials, Region, Resources } from "./types";
import { REGIONS } from "./data";

export const canCraft = (materials: Materials, cost: Materials): boolean => {
  for (const [k, need] of Object.entries(cost)) {
    if ((materials[k as keyof Materials] ?? 0) < (need ?? 0)) return false;
  }
  return true;
};

export const subtractMaterials = (materials: Materials, cost: Materials): Materials => {
  const out: Materials = { ...materials };
  for (const [k, need] of Object.entries(cost)) {
    out[k as keyof Materials] = (out[k as keyof Materials] ?? 0) - (need ?? 0);
  }
  return out;
};

export const addMaterials = (a: Materials, b: Materials): Materials => {
  const out: Materials = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k as keyof Materials] = (out[k as keyof Materials] ?? 0) + (v ?? 0);
  }
  return out;
};

export const findRegion = (id: string): Region | undefined => REGIONS.find((r) => r.id === id);

export const canAfford = (resources: Resources, cost: { gold: number; iron: number }) =>
  resources.gold >= cost.gold && resources.iron >= cost.iron;

export const subtractCost = (
  resources: Resources,
  cost: { gold: number; iron: number },
): Resources => ({
  gold: resources.gold - cost.gold,
  iron: resources.iron - cost.iron,
});
