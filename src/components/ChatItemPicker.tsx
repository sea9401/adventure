"use client";

import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import { TabBar } from "@/components/ui/TabBar";
import { rarityTextClass, type EquipSlot } from "@/adventure/data/items";
import { craftTierSuffix, craftTierTextClass } from "@/adventure/data/craftQuality";
import { dropQualityPrefix, dropQualityTextClass } from "@/adventure/data/dropQuality";
import {
  buildEquipEntries,
  type EquipEntry,
} from "@/adventure/inventory/equipEntries";
import type { InventoryState } from "@/adventure/inventory/useInventory";
import type { ChatItemRef } from "@/lib/chat-item-link";

const SLOT_TABS: { key: EquipSlot; label: string }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "accessory", label: "장신구" },
];

type Row = { ref: ChatItemRef; item: EquipEntry["item"]; count: number };

// 보유 장비 중 하나를 골라 채팅에 링크하는 시트. 동종(id+제작등급+드랍등급)은 한 줄 + ×개수.
export function ChatItemPicker({
  inventory,
  onPick,
  onClose,
}: {
  inventory: InventoryState;
  onPick: (ref: ChatItemRef) => void;
  onClose: () => void;
}) {
  const [slot, setSlot] = useState<EquipSlot>("weapon");
  const entries = useMemo(() => buildEquipEntries(inventory), [inventory]);
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const e of entries) {
      if (e.item.slot !== slot) continue;
      const key = `${e.id}|${e.tier ?? 0}|${e.quality ?? 0}`;
      const ex = map.get(key);
      if (ex) ex.count += 1;
      else map.set(key, { ref: { id: e.id, craftTier: e.tier, dropQuality: e.quality }, item: e.item, count: 1 });
    }
    return [...map.values()];
  }, [entries, slot]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-md flex-col rounded-t-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-lg"
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            채팅에 아이템 자랑하기
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </header>
        <TabBar
          tabs={SLOT_TABS}
          active={slot}
          onChange={setSlot}
          ariaLabel="장비 슬롯"
          className="px-3 pt-2"
        />
        <div className="no-scrollbar flex-1 overflow-y-auto p-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              이 칸에 보유한 장비가 없습니다.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={`${r.ref.id}|${r.ref.craftTier ?? 0}|${r.ref.dropQuality ?? 0}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r.ref);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white/70 px-3 py-2 text-left text-sm transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-500"
                  >
                    <span className="min-w-0 truncate font-medium">
                      <span className={dropQualityTextClass(r.ref.dropQuality)}>
                        {dropQualityPrefix(r.ref.dropQuality)}
                      </span>
                      <span className={rarityTextClass(r.item)}>{r.item.name}</span>
                      <span className={craftTierTextClass(r.ref.craftTier)}>
                        {craftTierSuffix(r.ref.craftTier)}
                      </span>
                      {r.count > 1 && (
                        <span className="ml-1 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                          ×{r.count}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {r.item.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
