"use client";

import { useState } from "react";
import { UserCircle } from "@phosphor-icons/react";
import type { Npc, NpcRole } from "./data/npcs";

const ROLE_COLOR: Record<NpcRole, string> = {
  elder: "text-amber-700",
  vendor: "text-emerald-600",
  innkeeper: "text-rose-500",
  quest: "text-blue-500",
  lore: "text-violet-500",
  stranger: "text-zinc-500",
  trainer: "text-orange-500",
};

export function NpcAvatar({
  npc,
  size,
  className = "",
}: {
  npc: Npc;
  size: number;
  className?: string;
}) {
  // 어떤 portrait 가 실패했는지 자체를 state 로 저장 — npc.portrait 가 바뀌면
  // 자동으로 비교가 다시 일어나면서 별도 effect 없이 reset 효과를 얻는다.
  const [erroredPortrait, setErroredPortrait] = useState<string | null>(null);
  const isErrored = erroredPortrait === npc.portrait;

  if (npc.portrait && !isErrored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={npc.portrait}
        alt={`${npc.name} 초상화`}
        onError={() => setErroredPortrait(npc.portrait ?? null)}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <UserCircle
      size={size}
      weight="duotone"
      className={`shrink-0 ${ROLE_COLOR[npc.role]} ${className}`}
    />
  );
}
