"use client";

import { CaretRight, Crown, MapPin, Scroll, Skull } from "@phosphor-icons/react";
import { useGame } from "@/adventure/GameContext";
import { COOP_BOSSES } from "@/adventure/coop/data";
import { WORLD_MAP, type Region } from "@/adventure/data/world";

const SCROLL_ID = "scroll_town_return" as const;

type Entry = {
  region: Region;
  cost: number; // 소비할 스크롤 개수
};

function regionLabel(region: Region): string {
  return region.recommendedLevel
    ? `${region.name} · 권장 Lv ${region.recommendedLevel}`
    : region.name;
}

function TravelRow({
  entry,
  scrollCount,
  onTravel,
}: {
  entry: Entry;
  scrollCount: number;
  onTravel: () => void;
}) {
  const insufficient = entry.cost > 0 && scrollCount < entry.cost;
  const disabled = insufficient;
  return (
    <button
      type="button"
      onClick={onTravel}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white/90 px-4 py-3 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90 dark:hover:bg-zinc-900/80 dark:disabled:hover:bg-zinc-950/90"
    >
      <MapPin
        size={24}
        weight="duotone"
        className="shrink-0 text-emerald-500"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {regionLabel(entry.region)}
        </span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          {entry.cost === 0
            ? "이동 무료"
            : insufficient
              ? `주문서 ×${entry.cost} (부족)`
              : `주문서 ×${entry.cost}`}
        </span>
      </span>
      <CaretRight
        size={16}
        weight="bold"
        aria-hidden
        className="shrink-0 text-zinc-400 dark:text-zinc-500"
      />
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
  const bossEntries: Entry[] = [];
  const towerEntries: Entry[] = [];

  for (const region of WORLD_MAP.regions) {
    if (region.id === currentId) continue;
    if (!visited.has(region.id)) continue;
    const isTown = region.tags?.includes("town") ?? false;
    const isTower = region.tags?.includes("tower") ?? false;
    const hasBoss = !!region.boss || !!COOP_BOSSES[region.id];
    if (isTown) {
      townEntries.push({ region, cost: fromIsTown ? 0 : 1 });
    } else if (isTower) {
      towerEntries.push({ region, cost: 1 });
    } else if (hasBoss) {
      bossEntries.push({ region, cost: 1 });
    }
  }

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
    <div className="space-y-4">
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
        emptyMessage="아직 방문한 다른 마을이 없다."
        entries={townEntries}
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
        title="보스"
        emptyMessage="아직 방문한 보스 지역이 없다."
        entries={bossEntries}
      >
        {bossEntries.map((e) => (
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
        emptyMessage="아직 고탑의 발치에 도달하지 못했다."
        entries={towerEntries}
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
  emptyMessage,
  entries,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  emptyMessage: string;
  entries: Entry[];
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {icon}
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white/60 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}
