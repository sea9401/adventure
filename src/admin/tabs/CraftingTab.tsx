"use client";

import { useEffect, useState } from "react";
import { loadBundle, writeBundleKey } from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, Checkbox } from "../ui/Field";
import { RECIPES } from "@/adventure/data/recipes";
import {
  emptyCraftingState,
  type CraftingState,
} from "@/adventure/crafting/storage";

export function CraftingTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [state, setState] = useState<CraftingState>(emptyCraftingState());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadBundle().data.crafting ?? emptyCraftingState());
  }, [bumpVersion]);

  const persist = (next: CraftingState) => {
    setState(next);
    writeBundleKey("crafting", next);
    bump();
    showToast("저장됨.");
  };

  const toggleKnown = (id: string, on: boolean) => {
    const set = new Set(state.known);
    if (on) set.add(id);
    else set.delete(id);
    persist({ ...state, known: Array.from(set) });
  };
  const toggleCrafted = (id: string, on: boolean) => {
    const set = new Set(state.crafted);
    if (on) set.add(id);
    else set.delete(id);
    persist({ ...state, crafted: Array.from(set) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={readOnly}
          onClick={() =>
            persist({
              ...state,
              known: RECIPES.map((r) => r.id),
              crafted: RECIPES.map((r) => r.id),
            })
          }
        >
          모든 레시피 해금/제작 표시
        </Button>
        <Button
          disabled={readOnly}
          onClick={() => persist(emptyCraftingState())}
        >
          제작 상태 초기화
        </Button>
      </div>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">레시피</h2>
        <div className="mt-2 overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["id", "이름", "해금", "제작 완료"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-left text-xs font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECIPES.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-2 py-1 font-mono text-xs">{r.id}</td>
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1">
                    <Checkbox
                      checked={state.known.includes(r.id)}
                      disabled={readOnly}
                      onChange={(v) => toggleKnown(r.id, v)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Checkbox
                      checked={state.crafted.includes(r.id)}
                      disabled={readOnly}
                      onChange={(v) => toggleCrafted(r.id, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">스토리 플래그</h2>
        <div className="mt-2 space-y-2">
          <Checkbox
            checked={state.boldQuestComplete}
            disabled={readOnly}
            onChange={(v) =>
              persist({ ...state, boldQuestComplete: v })
            }
            label="boldQuestComplete (대장장이 볼드 — 야구 방망이 완료)"
          />
          <Checkbox
            checked={state.boldSlimeQuestComplete}
            disabled={readOnly}
            onChange={(v) =>
              persist({ ...state, boldSlimeQuestComplete: v })
            }
            label="boldSlimeQuestComplete (대장장이 볼드 — 슬라임 핵 전달 완료)"
          />
        </div>
      </section>
    </div>
  );
}
