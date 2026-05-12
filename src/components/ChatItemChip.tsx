"use client";

import { useEffect, useRef, useState } from "react";
import { Diamond, Shield, Sword } from "@phosphor-icons/react";
import {
  ITEMS,
  rarityTextClass,
  type EquipItem,
  type EquipSlot,
} from "@/adventure/data/items";
import { craftTierSuffix, craftTierTextClass } from "@/adventure/data/craftQuality";
import {
  dropQualityPrefix,
  dropQualityTextClass,
  resolveDroppedItem,
} from "@/adventure/data/dropQuality";
import { resolveCraftedItem } from "@/adventure/data/recipes";
import type { ChatItemRef } from "@/lib/chat-item-link";

function slotIcon(slot: EquipSlot) {
  if (slot === "weapon") return <Sword size={12} weight="duotone" />;
  if (slot === "armor") return <Shield size={12} weight="duotone" />;
  return <Diamond size={12} weight="duotone" />;
}

// itemId + 등급 → 등급 반영된 EquipItem. (제작/드랍 등급 추첨 결과는 결정적으로 복원된다.)
export function resolveChatItem(ref: ChatItemRef): EquipItem {
  if (ref.craftTier) return resolveCraftedItem(ref.id, ref.craftTier);
  if (ref.dropQuality) return resolveDroppedItem(ref.id, ref.dropQuality);
  return ITEMS[ref.id];
}

// 채팅 메시지 안의 인라인 아이템 칩. 탭하면 스탯·설명 툴팁이 뜬다.
export function ChatItemChip({ link }: { link: ChatItemRef }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const item = resolveChatItem(link);
  const fullName = `${dropQualityPrefix(link.dropQuality)}${item.name}${craftTierSuffix(link.craftTier)}`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={fullName}
        className="inline-flex items-center gap-0.5 rounded border border-current/25 bg-current/10 px-1 py-px text-[0.92em] font-medium leading-tight hover:border-current/50"
      >
        {slotIcon(item.slot)}
        <span>
          <span className={dropQualityTextClass(link.dropQuality)}>
            {dropQualityPrefix(link.dropQuality)}
          </span>
          <span className={rarityTextClass(item, "")}>{item.name}</span>
          <span className={craftTierTextClass(link.craftTier)}>
            {craftTierSuffix(link.craftTier)}
          </span>
        </span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1 block w-48 rounded-lg border border-zinc-200 bg-white p-2.5 text-left text-xs font-normal text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <span className={`block font-medium ${rarityTextClass(item)}`}>{fullName}</span>
          <span className="mt-1.5 block space-y-0.5">
            {item.stats.map((s) => (
              <span key={s.label} className="flex items-baseline justify-between gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">{s.label}</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                  {s.value}
                </span>
              </span>
            ))}
          </span>
          {item.description && (
            <span className="mt-2 block border-t border-zinc-200 pt-2 italic text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {item.description}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
