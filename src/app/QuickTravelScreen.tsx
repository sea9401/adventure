"use client";

import { useState, type ReactNode } from "react";
import {
  CaretDown,
  CaretRight,
  Crown,
  MapPin,
  Scroll,
  Skull,
  UsersThree,
} from "@phosphor-icons/react";
import { useGame } from "@/adventure/GameContext";
import { COOP_BOSSES } from "@/adventure/coop/data";
import { WORLD_MAP, type Region } from "@/adventure/data/world";

const SCROLL_ID = "scroll_town_return" as const;

type Entry = {
  region: Region;
  label: string;
  cost: number; // 소비할 스크롤 개수
  isCurrent?: boolean; // 현재 위치 — 선택지에 유지하되 비활성 + "지금 여기" 표시
};

function TravelRow({
  entry,
  scrollCount,
  onTravel,
}: {
  entry: Entry;
  scrollCount: number;
  onTravel: () => void;
}) {
  const isCurrent = !!entry.isCurrent;
  const insufficient = !isCurrent && entry.cost > 0 && scrollCount < entry.cost;
  return (
    <button
      type="button"
      onClick={isCurrent ? undefined : onTravel}
      disabled={isCurrent || insufficient}
      aria-current={isCurrent ? "location" : undefined}
      className={
        isCurrent
          ? "flex w-full cursor-default items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50/80 px-4 py-3 text-left dark:border-emerald-800/70 dark:bg-emerald-950/40"
          : "flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white/90 px-4 py-3 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90 dark:hover:bg-zinc-900/80 dark:disabled:hover:bg-zinc-950/90"
      }
    >
      <MapPin
        size={24}
        weight={isCurrent ? "fill" : "duotone"}
        className={
          isCurrent
            ? "shrink-0 text-emerald-600 dark:text-emerald-400"
            : "shrink-0 text-emerald-500"
        }
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {entry.label}
        </span>
        <span
          className={
            isCurrent
              ? "block text-xs font-medium text-emerald-700 dark:text-emerald-300"
              : "block text-xs text-zinc-500 dark:text-zinc-400"
          }
        >
          {isCurrent
            ? "지금 여기"
            : entry.cost === 0
              ? "이동 무료"
              : insufficient
                ? `주문서 ×${entry.cost} (부족)`
                : `주문서 ×${entry.cost}`}
        </span>
      </span>
      {!isCurrent && (
        <CaretRight
          size={16}
          weight="bold"
          aria-hidden
          className="shrink-0 text-zinc-400 dark:text-zinc-500"
        />
      )}
    </button>
  );
}

export function QuickTravelScreen() {
  const {
    mapProgress,
    inventory,
    handleUseTownReturn,
    handleUseTravelScroll,
    addNotification,
  } = useGame();

  const scrollCount = inventory.consumableCount(SCROLL_ID);
  const visited = new Set(mapProgress.visitedRegionIds);
  const currentId = mapProgress.currentRegionId;
  const fromRegion = WORLD_MAP.regions.find((r) => r.id === currentId);
  const fromIsTown = !!fromRegion?.tags?.includes("town");

  const townEntries: Entry[] = [];
  const soloBossEntries: Entry[] = [];
  const coopBossEntries: Entry[] = [];
  const towerEntries: Entry[] = [];

  for (const region of WORLD_MAP.regions) {
    if (!visited.has(region.id)) continue;
    const isCurrent = region.id === currentId;
    const isTown = region.tags?.includes("town") ?? false;
    const isTower = region.tags?.includes("tower") ?? false;
    const coopBoss = COOP_BOSSES[region.id];
    const isSoloBoss = !!region.boss && !coopBoss;
    if (isTown) {
      townEntries.push({
        region,
        label: region.name,
        cost: fromIsTown ? 0 : 1,
        isCurrent,
      });
    } else if (isTower) {
      towerEntries.push({ region, label: region.name, cost: 1, isCurrent });
    } else if (coopBoss) {
      coopBossEntries.push({
        region,
        label: coopBoss.monsterName,
        cost: 1,
        isCurrent,
      });
    } else if (isSoloBoss && region.boss) {
      soloBossEntries.push({
        region,
        label: region.boss.monsterName,
        cost: 1,
        isCurrent,
      });
    }
  }

  // 정렬은 의도적으로 하지 않는다 — 현재 위치를 최상단으로 옮기면 다른 항목 자리가
  // 함께 흔들려, "메뉴 위치가 바뀌는 게 불편" 이라는 원래 피드백과 정면으로 어긋난다.
  // world.ts 정의 순서 (방문 순서에 가까움) 를 그대로 유지하고, 현재 위치는 그 자리에서
  // isCurrent 표시 + 비활성으로만 구분한다.

  const onTravelTown = (region: Region, cost: number) => {
    if (cost > 0 && scrollCount < cost) {
      addNotification("info", "귀환 주문서가 부족하다.");
      return;
    }
    handleUseTownReturn(region.id);
  };

  const onTravelScroll = (region: Region) => {
    if (scrollCount < 1) {
      addNotification("info", "귀환 주문서가 부족하다.");
      return;
    }
    handleUseTravelScroll(region.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <Scroll size={20} weight="duotone" className="text-amber-500" />
          <span>마을 귀환 주문서</span>
        </div>
        <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
          ×{scrollCount}
        </span>
      </div>

      <Section
        icon={<MapPin size={18} weight="duotone" className="text-blue-500" />}
        title="마을"
        count={townEntries.length}
        emptyMessage="아직 방문한 다른 마을이 없다."
      >
        {townEntries.map((e) => (
          <TravelRow
            key={e.region.id}
            entry={e}
            scrollCount={scrollCount}
            onTravel={() => onTravelTown(e.region, e.cost)}
          />
        ))}
      </Section>

      <Section
        icon={<Skull size={18} weight="duotone" className="text-rose-500" />}
        title="싱글 보스"
        count={soloBossEntries.length}
        emptyMessage="아직 방문한 싱글 보스 지역이 없다."
      >
        {soloBossEntries.map((e) => (
          <TravelRow
            key={e.region.id}
            entry={e}
            scrollCount={scrollCount}
            onTravel={() => onTravelScroll(e.region)}
          />
        ))}
      </Section>

      <Section
        icon={
          <UsersThree
            size={18}
            weight="duotone"
            className="text-violet-500"
          />
        }
        title="협동 보스"
        count={coopBossEntries.length}
        emptyMessage="아직 방문한 협동 보스 지역이 없다."
      >
        {coopBossEntries.map((e) => (
          <TravelRow
            key={e.region.id}
            entry={e}
            scrollCount={scrollCount}
            onTravel={() => onTravelScroll(e.region)}
          />
        ))}
      </Section>

      <Section
        icon={<Crown size={18} weight="duotone" className="text-amber-500" />}
        title="고탑"
        count={towerEntries.length}
        emptyMessage="아직 고탑의 발치에 도달하지 못했다."
      >
        {towerEntries.map((e) => (
          <TravelRow
            key={e.region.id}
            entry={e}
            scrollCount={scrollCount}
            onTravel={() => onTravelScroll(e.region)}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  emptyMessage,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900/80"
      >
        {icon}
        <span className="flex-1">
          {title}
          <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
            ({count})
          </span>
        </span>
        <CaretDown
          size={16}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-zinc-200 p-2 dark:border-zinc-800">
          {count === 0 ? (
            <div className="rounded-md px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              {emptyMessage}
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}
