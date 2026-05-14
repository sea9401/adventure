"use client";

import { useState } from "react";
import { TabBar } from "@/components/ui/TabBar";
import type { TitleId } from "@/adventure/data/titles";
import type { StatKey } from "@/adventure/data/stats";
import type { AdventureLog } from "@/adventure/log/storage";
import type { ItemId } from "@/adventure/data/items";
import type {
  InventoryState,
  VaultState,
} from "@/adventure/inventory/useInventory";
import type { CraftTier } from "@/adventure/data/craftQuality";
import type { DropQuality } from "@/adventure/data/dropQuality";
import { ItemsTab } from "./tabs/ItemsTab";
import { TownsTab } from "./tabs/TownsTab";
import { PlacesTab } from "./tabs/PlacesTab";
import { EtcTab } from "./tabs/EtcTab";
import { TitlesTab } from "./tabs/TitlesTab";
import type { TitleCounterValues } from "./tabs/shared";

export type { TitleCounterValues };

type LogTabKey = "places" | "towns" | "items" | "etc" | "titles";

const LOG_TABS: { key: LogTabKey; label: string }[] = [
  { key: "places", label: "장소·몬스터" },
  { key: "towns", label: "마을·NPC" },
  { key: "items", label: "아이템" },
  { key: "etc", label: "스탯" },
  { key: "titles", label: "칭호" },
];

export function AdventureLogView({
  log,
  stats,
  equippedTitleId,
  onEquipTitle,
  titleCounters,
  knownRecipes,
  shareableRecipes,
  inventory,
  vault,
  onDepositToVault,
  onWithdrawFromVault,
}: {
  log: AdventureLog;
  stats: Record<StatKey, number>;
  equippedTitleId?: string | null;
  onEquipTitle?: (titleId: TitleId | null) => void;
  /** 카운터형 칭호의 현재 진행도 — 절반 도달 시 조건 미리보기. */
  titleCounters?: TitleCounterValues;
  /** 학습한 제작서 id 목록. 미지정 시 빈 목록으로 처리. */
  knownRecipes?: string[];
  /** 거래/우편 공유 가능한 제작서 id 목록. 학습 시 자동 부여, 공유 시 소비. */
  shareableRecipes?: string[];
  /** 인벤 상태 — 도감 카드의 "보유 N" 뱃지 + "보관" 버튼 산출용. */
  inventory?: InventoryState;
  /** 도감 보관함 상태 (itemId × variantKey → 개수). */
  vault?: VaultState;
  /** 인벤 → 보관함. */
  onDepositToVault?: (
    id: ItemId,
    tier?: CraftTier,
    quality?: DropQuality,
  ) => void;
  /** 보관함 → 인벤 — vault[id][variantKey] 의 1개를 인벤으로 환원. */
  onWithdrawFromVault?: (id: ItemId, variantKey: string) => void;
}) {
  const [tab, setTab] = useState<LogTabKey>("places");

  return (
    <div className="space-y-3">
      <TabBar
        tabs={LOG_TABS}
        active={tab}
        onChange={setTab}
        ariaLabel="모험의 서 탭"
        scrollable
      />

      {tab === "places" && <PlacesTab log={log} />}
      {tab === "items" && (
        <ItemsTab
          knownRecipes={knownRecipes ?? []}
          shareableRecipes={shareableRecipes ?? []}
          discovered={log.discoveredEquipment ?? {}}
          vault={vault}
          inventory={inventory}
          onWithdraw={onWithdrawFromVault}
          onDeposit={onDepositToVault}
        />
      )}
      {tab === "towns" && <TownsTab log={log} />}
      {tab === "etc" && <EtcTab stats={stats} />}
      {tab === "titles" && (
        <TitlesTab
          log={log}
          equippedTitleId={equippedTitleId ?? null}
          onEquipTitle={onEquipTitle}
          titleCounters={titleCounters ?? {}}
        />
      )}
    </div>
  );
}
