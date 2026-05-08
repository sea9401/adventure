"use client";

import { useEffect, useState } from "react";
import {
  loadBundle,
  writeBundleKey,
} from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, Checkbox, TextInput } from "../ui/Field";
import { DangerAction } from "../ui/DangerAction";
import { POTIONS, potionMax, type PotionId } from "@/adventure/data/potions";
import { ITEMS, type ItemId } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import type { InventoryState } from "@/adventure/inventory/useInventory";

const emptyInventory = (): InventoryState => ({
  potions: {},
  equipment: {},
  materials: {},
});

export function InventoryTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [state, setState] = useState<InventoryState>(emptyInventory());
  const [hideEmpty, setHideEmpty] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loaded = loadBundle().data.inventory ?? emptyInventory();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded);
  }, [bumpVersion]);

  const persist = (next: InventoryState) => {
    setState(next);
    writeBundleKey("inventory", next);
    bump();
    showToast("저장됨.");
  };

  const setPotion = (id: PotionId, n: number) => {
    const next: InventoryState = {
      ...state,
      potions: { ...state.potions, [id]: Math.max(0, n) },
    };
    persist(next);
  };
  const setEquip = (id: ItemId, n: number) => {
    const next: InventoryState = {
      ...state,
      equipment: { ...state.equipment, [id]: Math.max(0, n) },
    };
    persist(next);
  };
  const setMaterial = (id: MaterialId, n: number) => {
    const next: InventoryState = {
      ...state,
      materials: { ...state.materials, [id]: Math.max(0, n) },
    };
    persist(next);
  };

  const filterMatch = (id: string, name: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return id.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  };

  const potionRows = Object.values(POTIONS)
    .filter((p) => filterMatch(p.id, p.name))
    .filter((p) => !hideEmpty || (state.potions[p.id] ?? 0) > 0);
  const equipRows = (Object.entries(ITEMS) as [ItemId, (typeof ITEMS)[ItemId]][])
    .filter(([id, item]) => filterMatch(id, item.name))
    .filter(([id]) => !hideEmpty || (state.equipment[id] ?? 0) > 0);
  const matRows = (Object.entries(MATERIALS) as [MaterialId, (typeof MATERIALS)[MaterialId]][])
    .filter(([id, m]) => filterMatch(id, m.name))
    .filter(([id]) => !hideEmpty || (state.materials[id] ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grow"><TextInput value={query} onChange={setQuery} placeholder="검색…" /></div>
        <Checkbox
          checked={hideEmpty}
          onChange={setHideEmpty}
          label="비어 있는 항목 숨김"
        />
        <DangerAction
          disabled={readOnly}
          trigger="인벤토리 비우기"
          title="모든 인벤토리 삭제"
          description="포션·장비·재료 보유 수량을 모두 0으로 만듭니다."
          confirmText="EMPTY"
          onConfirm={() => persist(emptyInventory())}
        />
      </div>

      <Section
        title="포션"
        hint={`종류별 최대 ${potionMax(state.potionCapacityBonus ?? 0)}${
          (state.potionCapacityBonus ?? 0) > 0
            ? ` (보너스 +${state.potionCapacityBonus})`
            : ""
        }`}
      >
        <Table>
          <THead headers={["id", "이름", "보유", "액션"]} />
          <tbody>
            {potionRows.map((p) => {
              const n = state.potions[p.id] ?? 0;
              const cap = potionMax(state.potionCapacityBonus ?? 0);
              const over = n > cap;
              return (
                <Row key={p.id}>
                  <Cell mono>{p.id}</Cell>
                  <Cell>{p.name}</Cell>
                  <Cell>
                    <span className={over ? "text-amber-600 dark:text-amber-400" : undefined}>
                      {n}
                      {over ? " ⚠️" : ""}
                    </span>
                  </Cell>
                  <Cell>
                    <RowActions
                      onAdd={(d) => setPotion(p.id, n + d)}
                      onSet={(v) => setPotion(p.id, v)}
                      maxQuick={cap}
                      readOnly={readOnly}
                    />
                  </Cell>
                </Row>
              );
            })}
          </tbody>
        </Table>
      </Section>

      <Section title="장비">
        <Table>
          <THead headers={["id", "이름", "슬롯", "보유", "액션"]} />
          <tbody>
            {equipRows.map(([id, item]) => {
              const n = state.equipment[id] ?? 0;
              return (
                <Row key={id}>
                  <Cell mono>{id}</Cell>
                  <Cell>{item.name}</Cell>
                  <Cell>{item.slot}</Cell>
                  <Cell>{n}</Cell>
                  <Cell>
                    <RowActions
                      onAdd={(d) => setEquip(id, n + d)}
                      onSet={(v) => setEquip(id, v)}
                      readOnly={readOnly}
                    />
                  </Cell>
                </Row>
              );
            })}
          </tbody>
        </Table>
      </Section>

      <Section title="재료">
        <Table>
          <THead headers={["id", "이름", "보유", "액션"]} />
          <tbody>
            {matRows.map(([id, m]) => {
              const n = state.materials[id] ?? 0;
              return (
                <Row key={id}>
                  <Cell mono>{id}</Cell>
                  <Cell>{m.name}</Cell>
                  <Cell>{n}</Cell>
                  <Cell>
                    <RowActions
                      onAdd={(d) => setMaterial(id, n + d)}
                      onSet={(v) => setMaterial(id, v)}
                      readOnly={readOnly}
                    />
                  </Cell>
                </Row>
              );
            })}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function THead({ headers }: { headers: string[] }) {
  return (
    <thead className="bg-zinc-100 dark:bg-zinc-900">
      <tr>
        {headers.map((h) => (
          <th
            key={h}
            className="px-2 py-1 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-800">{children}</tr>
  );
}

function Cell({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-2 py-1 align-middle ${mono ? "font-mono text-xs" : ""}`}>
      {children}
    </td>
  );
}

function RowActions({
  onAdd,
  onSet,
  maxQuick,
  readOnly,
}: {
  onAdd: (delta: number) => void;
  onSet: (value: number) => void;
  maxQuick?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <Button disabled={readOnly} onClick={() => onAdd(1)}>+1</Button>
      <Button disabled={readOnly} onClick={() => onAdd(10)}>+10</Button>
      <Button disabled={readOnly} onClick={() => onAdd(-1)}>−1</Button>
      {maxQuick !== undefined ? (
        <Button disabled={readOnly} onClick={() => onSet(maxQuick)}>최대</Button>
      ) : null}
      <Button disabled={readOnly} onClick={() => onSet(0)}>0</Button>
    </div>
  );
}
