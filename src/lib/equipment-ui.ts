import type { EquipmentDef, EquipmentSlot, SetId } from "@/lib/game/types";

export const EQUIPMENT_SLOT_LABEL_COLOR: Record<EquipmentSlot, string> = {
  head: "text-slate-400",
  body: "text-stone-400",
  gloves: "text-fg-muted",
  boots: "text-amber-200/60",
  weapon: "text-rose-300/60",
  ring: "text-violet-300/70",
};

// 중간 티어 세트 — 후반부 컨텐츠 진입 시점의 세트들 (사막~유령선).
// 색상으로 진행 단계를 시각화 (초반 흰색 / 중반 하늘색 / 보스 유니크는 별도 색).
const SET_RARITY_MID: ReadonlySet<SetId> = new Set<SetId>([
  "desert_set",
  "snow_set",
  "pirate_set",
  "ghost_set",
]);

// 장비 이름 색상: 보스 드랍 전용(주황) > 보스 제작 유니크(자홍) > 중간 티어 세트(하늘) > 기본(흰색)
// 색상은 globals.css의 CSS 변수로 정의되어 라이트/다크 테마별 톤 조정됨
export const getEquipmentNameColor = (def: EquipmentDef): string => {
  if (def.dropOnly) return "rarity-drop";
  if (def.bossLabel && !def.setId) return "rarity-craft";
  if (def.setId && SET_RARITY_MID.has(def.setId)) return "rarity-set-mid";
  return "";
};

export function fmtStat(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
