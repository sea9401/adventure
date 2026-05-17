"use client";

import { useEffect, useState } from "react";
import { loadBundle, writeBundleKey } from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, NumberInput } from "../ui/Field";
import { DangerAction } from "../ui/DangerAction";
import {
  RUNES,
  RUNE_GRADES,
  RUNE_IDS,
  getRuneMagnitude,
  type RuneGrade,
  type RuneId,
} from "@/adventure/data/runes";
import {
  emptyInventory,
  type InventoryState,
} from "@/adventure/inventory/useInventory";

export function RunesTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [inventory, setInventory] = useState<InventoryState>(emptyInventory());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInventory(loadBundle().data.inventory ?? emptyInventory());
  }, [bumpVersion]);

  const persist = (next: InventoryState) => {
    setInventory(next);
    writeBundleKey("inventory", next);
    bump();
    showToast("저장됨.");
  };

  const setRune = (id: RuneId, grade: RuneGrade, n: number) => {
    const safe = Math.max(0, Math.floor(n));
    const runes = { ...(inventory.runes ?? {}) };
    const idMap = { ...(runes[id] ?? {}) };
    if (safe > 0) idMap[grade] = safe;
    else delete idMap[grade];
    if (Object.keys(idMap).length > 0) runes[id] = idMap;
    else delete runes[id];
    persist({ ...inventory, runes });
  };

  const grantAll = (n: number) => {
    const runes: NonNullable<InventoryState["runes"]> = {};
    for (const id of RUNE_IDS) {
      const map: Partial<Record<RuneGrade, number>> = {};
      for (const g of RUNE_GRADES) map[g] = n;
      runes[id] = map;
    }
    persist({ ...inventory, runes });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={readOnly} onClick={() => grantAll(3)}>
          모든 룬 ×3
        </Button>
        <Button disabled={readOnly} onClick={() => grantAll(10)}>
          모든 룬 ×10
        </Button>
        <DangerAction
          disabled={readOnly}
          trigger="모든 룬 비우기"
          title="룬 가방 비우기"
          description="장착은 그대로 두고 가방 보유량만 0으로."
          confirmText="WIPE RUNES"
          onConfirm={() => persist({ ...inventory, runes: {} })}
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold">룬 종류 × 등급</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          PR-A 가산형 7종 × 5등급. 효과는 derivePlayerCombat / onBattleEnd /
          battle engine 에서 % 가산. 슬롯 장착은 게임 내 룬 페이지에서.
        </p>
        <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  룬
                </th>
                {RUNE_GRADES.map((g) => (
                  <th
                    key={g}
                    className="px-2 py-1 text-left text-xs font-semibold"
                  >
                    {g}T
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RUNE_IDS.map((id) => {
                const def = RUNES[id];
                return (
                  <tr
                    key={id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-2 py-1">
                      <div className="text-sm font-medium">{def.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        {def.effect}
                      </div>
                    </td>
                    {RUNE_GRADES.map((g) => {
                      const have = inventory.runes?.[id]?.[g] ?? 0;
                      return (
                        <td key={g} className="px-2 py-1 w-28">
                          <div className="flex items-center gap-1">
                            <div className="w-20">
                              <NumberInput
                                value={have}
                                min={0}
                                disabled={readOnly}
                                onChange={(n) => setRune(id, g, n)}
                              />
                            </div>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              +{getRuneMagnitude(id, g)}%
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
