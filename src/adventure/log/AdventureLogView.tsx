"use client";

import { useState } from "react";
import { TabBar } from "@/components/ui/TabBar";
import type { ItemId } from "@/adventure/data/items";
import type { EquippedSlots } from "@/adventure/character/types";
import type { TitleId } from "@/adventure/data/titles";
import type { StatKey } from "@/adventure/data/stats";
import type { AdventureLog } from "@/adventure/log/storage";
import { MonstersTab } from "./tabs/MonstersTab";
import { ItemsTab } from "./tabs/ItemsTab";
import { NpcsTab } from "./tabs/NpcsTab";
import { TownsTab } from "./tabs/TownsTab";
import { PlacesTab } from "./tabs/PlacesTab";
import { EtcTab } from "./tabs/EtcTab";
import { TitlesTab } from "./tabs/TitlesTab";
import type { TitleCounterValues } from "./tabs/shared";

export type { TitleCounterValues };

type LogTabKey =
  | "monsters"
  | "items"
  | "npcs"
  | "towns"
  | "places"
  | "etc"
  | "titles";

const LOG_TABS: { key: LogTabKey; label: string }[] = [
  { key: "monsters", label: "몬스터" },
  { key: "items", label: "아이템" },
  { key: "npcs", label: "NPC" },
  { key: "towns", label: "마을" },
  { key: "places", label: "장소" },
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
  ownedEquipment,
  equippedSlots,
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
  /** 보유 장비 — itemId → 보유 수량. 미지정 시 빈 목록으로 처리. */
  ownedEquipment?: Partial<Record<ItemId, number>>;
  /** 현재 장착 중인 슬롯 — '장착중' 배지 표기용. */
  equippedSlots?: EquippedSlots;
}) {
  const [tab, setTab] = useState<LogTabKey>("monsters");

  return (
    <div className="space-y-3">
      <TabBar
        tabs={LOG_TABS}
        active={tab}
        onChange={setTab}
        ariaLabel="모험의 서 탭"
        scrollable
      />

      {tab === "monsters" && <MonstersTab log={log} />}
      {tab === "items" && (
        <ItemsTab
          knownRecipes={knownRecipes ?? []}
          shareableRecipes={shareableRecipes ?? []}
          ownedEquipment={ownedEquipment ?? {}}
          equippedSlots={equippedSlots}
        />
      )}
      {tab === "npcs" && <NpcsTab log={log} />}
      {tab === "towns" && <TownsTab log={log} />}
      {tab === "places" && <PlacesTab log={log} />}
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
