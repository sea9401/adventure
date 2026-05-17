"use client";

import { Envelope, Note, Storefront, Sword, Trophy } from "@phosphor-icons/react";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { BulletinBoardView } from "@/adventure/BulletinBoardView";
import { MarketplaceTab } from "@/adventure/marketplace/MarketplaceTab";
import { InboxView } from "@/adventure/marketplace/InboxView";
import { RankingsView } from "@/adventure/rankings/RankingsView";
import { ArenaView } from "@/adventure/pvp/ArenaView";
import { useGame } from "@/adventure/GameContext";

export function PlazaScreen() {
  const { subView, setSubView, back, inbox } = useGame();

  if (subView === null) {
    return (
      <div className="space-y-2">
        <EntryCard
          icon={
            <Storefront
              size={28}
              weight="duotone"
              className="text-emerald-500"
            />
          }
          title="거래소"
          description="다른 모험가와 아이템을 사고팔 수 있는 곳."
          onClick={() => setSubView("marketplace")}
        />
        <EntryCard
          icon={<Note size={28} weight="duotone" className="text-sky-500" />}
          title="게시판"
          description="마을의 새 소식이 올라오는 곳."
          onClick={() => setSubView("bulletin")}
        />
        <EntryCard
          icon={
            <Envelope size={28} weight="duotone" className="text-amber-500" />
          }
          title={
            inbox.count !== null && inbox.count > 0
              ? `우편함 (${inbox.count})`
              : "우편함"
          }
          description={
            inbox.count !== null && inbox.count > 0
              ? "거래소에서 도착한 우편이 있습니다."
              : "거래소 거래 결과가 도착하는 곳."
          }
          onClick={() => setSubView("inbox")}
        />
        <EntryCard
          icon={
            <Trophy size={28} weight="duotone" className="text-amber-600" />
          }
          title="랭킹"
          description="모험가 명부 — 등록한 사람들의 레벨, 명성, 전투 횟수 순위."
          onClick={() => setSubView("rankings")}
        />
        <EntryCard
          icon={<Sword size={28} weight="duotone" className="text-rose-500" />}
          title="투기장"
          description="다른 모험가와 비동기 1:1 도전 — 시즌 Elo 랭킹."
          onClick={() => setSubView("arena")}
        />
      </div>
    );
  }

  if (subView === "bulletin") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="게시판" onBack={back} />
        <BulletinBoardView />
      </div>
    );
  }

  if (subView === "marketplace") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="거래소" onBack={back} />
        <MarketplaceTab />
      </div>
    );
  }

  if (subView === "inbox") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="우편함" onBack={back} />
        <InboxView />
      </div>
    );
  }

  if (subView === "rankings") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="랭킹" onBack={back} />
        <RankingsView />
      </div>
    );
  }

  if (subView === "arena") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="투기장" onBack={back} />
        <ArenaView />
      </div>
    );
  }

  return null;
}
