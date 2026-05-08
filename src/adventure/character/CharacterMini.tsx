import { Diamond, Shield, Sword, User } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { StatBar } from "@/components/ui/StatBar";
import type { Gender } from "@/components/NameSetupModal";
import type { EquipItem } from "@/adventure/data/items";
import type { Character } from "./types";

function CharacterPortrait({ gender }: { gender: Gender }) {
  const [errored, setErrored] = useState(false);
  return (
    <div
      aria-label="캐릭터 이미지"
      className="flex aspect-square w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-300 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-600"
    >
      {errored ? (
        <User size={56} weight="duotone" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/images/character/${gender}.webp`}
          alt=""
          onError={() => setErrored(true)}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

type TooltipAlign = "start" | "center" | "end";

const TOOLTIP_ALIGN: Record<TooltipAlign, string> = {
  // 그리드 모서리 셀에서 화면 밖으로 잘리지 않도록 셀 안쪽 가장자리에 정렬.
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

function MiniEquipCard({
  icon,
  label,
  item,
  tooltipAlign = "center",
}: {
  icon: ReactNode;
  label: string;
  item: EquipItem | null;
  tooltipAlign?: TooltipAlign;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const showOnHover = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setOpen(true);
  };
  const hideOnLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setOpen(false);
  };
  const toggleOnTap = () => {
    if (item) setOpen((v) => !v);
  };

  return (
    <div
      ref={ref}
      className={`relative flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50 ${
        item ? "cursor-pointer" : ""
      }`}
      onPointerEnter={item ? showOnHover : undefined}
      onPointerLeave={item ? hideOnLeave : undefined}
      onClick={toggleOnTap}
      aria-expanded={item ? open : undefined}
    >
      <span className="flex shrink-0 items-center text-zinc-700 dark:text-zinc-300">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </div>
        <div className="truncate text-xs">
          {item ? (
            <span className="text-zinc-800 dark:text-zinc-200">{item.name}</span>
          ) : (
            <span className="italic text-zinc-400 dark:text-zinc-600">없음</span>
          )}
        </div>
      </div>

      {item && open && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute top-full z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${TOOLTIP_ALIGN[tooltipAlign]}`}
        >
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            {item.name}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {item.stats.map((s) => (
              <div
                key={s.label}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-zinc-500 dark:text-zinc-400">
                  {s.label}
                </span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
          {item.description && (
            <div className="mt-2 border-t border-zinc-200 pt-2 text-xs italic text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {item.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CharacterMini({ character }: { character: Character }) {
  const equipped = [
    {
      icon: <Sword size={18} weight="duotone" className="text-rose-500" />,
      label: "무기",
      item: character.equipped.weapon,
    },
    {
      icon: <Shield size={18} weight="duotone" className="text-sky-500" />,
      label: "방어구",
      item: character.equipped.armor,
    },
    {
      icon: <Diamond size={18} weight="duotone" className="text-violet-500" />,
      label: "장신구",
      item: character.equipped.accessory,
    },
  ];
  return (
    <Card as="section" padding="none">
      <div className="space-y-3 p-4">
        <div className="flex items-stretch gap-4">
          <CharacterPortrait gender={character.gender} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-base font-semibold">{character.name}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {character.className}
              </span>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                Lv.{character.level}
              </span>
            </div>
            <div className="max-w-sm space-y-2">
              <StatBar
                label="HP"
                value={character.hp}
                max={character.maxHp}
                color="bg-red-500"
              />
              <StatBar
                label="MP"
                value={character.mp}
                max={character.maxMp}
                color="bg-sky-500"
              />
              <StatBar
                label="EXP"
                value={character.exp}
                max={character.maxExp}
                color="bg-amber-400"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {equipped.map(({ icon, label, item }, i) => (
            <MiniEquipCard
              key={label}
              icon={icon}
              label={label}
              item={item}
              tooltipAlign={
                i === 0
                  ? "start"
                  : i === equipped.length - 1
                    ? "end"
                    : "center"
              }
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
