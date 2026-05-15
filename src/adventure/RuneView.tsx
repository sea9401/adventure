"use client";

import { useMemo, useState } from "react";
import { ArrowsClockwise, Diamond, X } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import {
  RUNES,
  RUNE_GRADES,
  RUNE_IDS,
  RUNE_SLOT_COUNT,
  getRuneMagnitude,
  type EquippedRune,
  type RuneGrade,
  type RuneId,
} from "@/adventure/data/runes";
import {
  isFusionError,
  planRuneFusion,
  RUNE_FUSION_COST,
} from "@/adventure/character/runeFusion";

type RuneInventory = Partial<Record<RuneId, Partial<Record<RuneGrade, number>>>>;

// 룬 효과 종류별 단위 표시.
function effectLine(id: RuneId, grade: RuneGrade): string {
  const def = RUNES[id];
  const n = getRuneMagnitude(id, grade);
  switch (def.effect) {
    case "atk_pct":
      return `공격력 +${n}%`;
    case "def_pct":
      return `방어력 +${n}%`;
    case "hp_pct":
      return `최대 HP +${n}%`;
    case "crit_pct":
      return `치명타 확률 +${n}%`;
    case "exp_pct":
      return `EXP 획득 +${n}%`;
    case "drop_pct":
      return `드롭률 +${n}%`;
    case "potion_pct":
      return `포션 회복량 +${n}%`;
    case "counter_pct":
      return `피격 시 ${n}% 확률로 반격`;
    case "lifesteal_pct":
      return `명중 피해의 ${n}% HP 회복`;
    case "regen_pct":
      return `전투 승리 시 최대 HP ${n}% 회복`;
  }
}

function gradeColor(grade: RuneGrade): string {
  switch (grade) {
    case 1:
      return "text-zinc-500 dark:text-zinc-400";
    case 2:
      return "text-emerald-600 dark:text-emerald-400";
    case 3:
      return "text-sky-600 dark:text-sky-400";
    case 4:
      return "text-violet-600 dark:text-violet-400";
    case 5:
      return "text-amber-600 dark:text-amber-400";
  }
}

function gradeLabel(grade: RuneGrade): string {
  return `${grade}등급`;
}

// 같은 (id, grade) 룬을 두 슬롯에 끼지 못하도록 — 가방 잔량 < 장착 카운트면 제한.
function alreadyEquippedCount(
  equipped: ReadonlyArray<EquippedRune | null>,
  id: RuneId,
  grade: RuneGrade,
): number {
  let n = 0;
  for (const r of equipped) {
    if (r && r.id === id && r.grade === grade) n += 1;
  }
  return n;
}

export function RuneView({
  equippedRunes,
  runeInventory,
  onEquip,
  onFuse,
}: {
  equippedRunes: ReadonlyArray<EquippedRune | null>;
  runeInventory: RuneInventory;
  onEquip: (slotIndex: number, rune: EquippedRune | null) => void;
  /** 합성 — id × grade ×3 → 같은 id 의 grade+1 ×1. 호출부가 인벤에서 직접 차감/증가. */
  onFuse: (id: RuneId, fromGrade: RuneGrade) => void;
}) {
  // 현재 활성 슬롯 — 클릭하면 인벤에서 룬을 선택해 채운다.
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // 슬롯 자리 정규화 — undefined/[] 도 RUNE_SLOT_COUNT 자리만큼 null 로 보이게.
  const slots = useMemo(() => {
    const out: (EquippedRune | null)[] = [];
    for (let i = 0; i < RUNE_SLOT_COUNT; i += 1) {
      out.push(equippedRunes[i] ?? null);
    }
    return out;
  }, [equippedRunes]);

  // 보유 룬 목록 — id × grade 의 평탄 리스트, 보유 0 인 항목은 제외.
  const inventoryRows = useMemo(() => {
    const rows: { id: RuneId; grade: RuneGrade; count: number }[] = [];
    for (const id of RUNE_IDS) {
      for (const g of RUNE_GRADES) {
        const n = runeInventory[id]?.[g] ?? 0;
        if (n > 0) rows.push({ id, grade: g, count: n });
      }
    }
    return rows;
  }, [runeInventory]);

  const handlePick = (id: RuneId, grade: RuneGrade) => {
    if (activeSlot === null) return;
    const owned = runeInventory[id]?.[grade] ?? 0;
    const alreadyOther = (() => {
      let n = 0;
      for (let i = 0; i < slots.length; i += 1) {
        if (i === activeSlot) continue;
        const r = slots[i];
        if (r && r.id === id && r.grade === grade) n += 1;
      }
      return n;
    })();
    // 같은 (id, grade) 룬 보유량보다 더 많이 장착할 수 없다.
    if (alreadyOther >= owned) return;
    onEquip(activeSlot, { id, grade });
    setActiveSlot(null);
  };

  return (
    <div className="space-y-3">
      <Card as="section" padding="md">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <Diamond size={18} weight="duotone" className="text-violet-500" />
          장착 슬롯 ({slots.filter((s) => s).length}/{RUNE_SLOT_COUNT})
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {slots.map((slot, i) => (
            <SlotCard
              key={i}
              slot={slot}
              active={activeSlot === i}
              onClick={() => setActiveSlot(activeSlot === i ? null : i)}
              onClear={
                slot ? () => onEquip(i, null) : undefined
              }
            />
          ))}
        </div>
      </Card>

      <Card as="section" padding="md">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            보유 룬
          </div>
          {activeSlot !== null && (
            <div className="text-xs text-violet-600 dark:text-violet-400">
              슬롯 {activeSlot + 1} 선택 중 — 룬을 골라 장착
            </div>
          )}
        </div>
        {inventoryRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            아직 보유한 룬이 없다.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {inventoryRows.map((row) => {
              const equippedHere = alreadyEquippedCount(
                slots,
                row.id,
                row.grade,
              );
              const remaining = row.count - equippedHere;
              const def = RUNES[row.id];
              const disabled =
                activeSlot === null ||
                // 활성 슬롯에 같은 (id, grade) 가 이미 있으면 무의미 (그 슬롯이 이미 같은 거)
                remaining <= 0;
              const fusion = planRuneFusion(row.id, row.grade, row.count);
              const canFuse = !isFusionError(fusion);
              return (
                <li key={`${row.id}_${row.grade}`} className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePick(row.id, row.grade)}
                    disabled={disabled}
                    className="flex flex-1 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:disabled:hover:bg-zinc-950"
                  >
                    <Diamond
                      size={16}
                      weight="duotone"
                      className={`shrink-0 ${gradeColor(row.grade)}`}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {def.name}
                        </span>{" "}
                        <span className={`text-xs ${gradeColor(row.grade)}`}>
                          {gradeLabel(row.grade)}
                        </span>
                      </span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {effectLine(row.id, row.grade)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      ×{remaining}
                      {equippedHere > 0 && (
                        <span className="ml-1 text-[10px] text-violet-500">
                          (장착 {equippedHere})
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onFuse(row.id, row.grade)}
                    disabled={!canFuse}
                    title={
                      canFuse
                        ? `${RUNE_FUSION_COST}개 → ${row.grade + 1}등급 1개`
                        : row.grade >= 5
                          ? "5등급은 합성 불가"
                          : `합성에 ${RUNE_FUSION_COST}개 필요`
                    }
                    aria-label="합성"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <ArrowsClockwise size={12} weight="bold" />
                    합성
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SlotCard({
  slot,
  active,
  onClick,
  onClear,
}: {
  slot: EquippedRune | null;
  active: boolean;
  onClick: () => void;
  onClear?: () => void;
}) {
  const ringClass = active
    ? "ring-2 ring-violet-500"
    : "ring-1 ring-zinc-200 dark:ring-zinc-800";
  return (
    <div
      className={`relative rounded-md bg-white p-3 dark:bg-zinc-950 ${ringClass}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        {slot ? (
          <>
            <div className="flex items-center gap-1.5">
              <Diamond
                size={16}
                weight="duotone"
                className={gradeColor(slot.grade)}
              />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {RUNES[slot.id].name}
              </span>
              <span className={`text-xs ${gradeColor(slot.grade)}`}>
                {gradeLabel(slot.grade)}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {effectLine(slot.id, slot.grade)}
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            빈 슬롯 — 눌러서 룬 선택
          </div>
        )}
      </button>
      {slot && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="해제"
          className="absolute right-1 top-1 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}
