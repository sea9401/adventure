"use client";

import { useEffect, useState } from "react";
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
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [npc.portrait]);

  if (npc.portrait && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={npc.portrait}
        alt={`${npc.name} 초상화`}
        onError={() => setErrored(true)}
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
