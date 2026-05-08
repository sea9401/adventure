"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { ITEMS, type ItemId } from "@/adventure/data/items";
import {
  MATERIALS,
  type MaterialId,
} from "@/adventure/data/materials";
import type { InventoryState } from "@/adventure/inventory/useInventory";
import type { EquippedSlots } from "@/adventure/character/types";
import type { RemoteSave } from "@/lib/storage/remote";
import { ListingsView } from "./ListingsView";
import { ListingCreateModal } from "./ListingCreateModal";
import { buyListing, cancelListing } from "./api";
import type { Listing } from "./types";

type SubTab = "all" | "mine";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "all", label: "전체 매물" },
  { key: "mine", label: "내 등록" },
];

export function MarketplaceTab({
  inventory,
  equipped,
  remote,
  consumeEquipment,
  consumeMaterial,
  addEquipment,
  addMaterial,
  addGold,
  inboxCount,
  refreshInbox,
  pushToast,
}: {
  inventory: InventoryState;
  equipped: EquippedSlots | undefined;
  remote: RemoteSave;
  consumeEquipment: (id: ItemId, n?: number) => boolean;
  consumeMaterial: (id: MaterialId, n?: number) => boolean;
  addEquipment: (id: ItemId, n?: number) => void;
  addMaterial: (id: MaterialId, n?: number) => void;
  addGold: (delta: number) => void;
  inboxCount: number | null;
  refreshInbox: () => void;
  pushToast: (msg: string) => void;
}) {
  const [sub, setSub] = useState<SubTab>("all");
  const [modal, setModal] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onBuy = useCallback(
    async (listing: Listing) => {
      setError(null);
      try {
        const r = await buyListing(remote, listing.id);
        // 서버가 골드 차감했으므로 클라 로컬도 -price 적용. 다음 PATCH 가
        // 구매 후 상태로 일관되게 보내짐.
        addGold(-listing.price);
        pushToast(
          `${r.itemName}${r.quantity > 1 ? ` ×${r.quantity}` : ""} 구매 완료 — 마을 우편함에서 수령하세요.`,
        );
        setRefresh((v) => v + 1);
        refreshInbox();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "구매 실패";
        setError(msg);
        pushToast(msg);
      }
    },
    [remote, addGold, pushToast, refreshInbox],
  );

  const onCancel = useCallback(
    async (listing: Listing) => {
      setError(null);
      try {
        await cancelListing(remote, listing.id);
        // 서버가 인벤토리에 환불했으므로 클라 로컬 상태도 동일 변경 — 그래야
        // useRemotePatch 가 보낼 다음 PATCH 가 일관된 값을 보낸다.
        if (listing.itemKind === "equip") {
          if (Object.prototype.hasOwnProperty.call(ITEMS, listing.itemId)) {
            addEquipment(listing.itemId as ItemId, listing.quantity);
          }
        } else {
          if (Object.prototype.hasOwnProperty.call(MATERIALS, listing.itemId)) {
            addMaterial(listing.itemId as MaterialId, listing.quantity);
          }
        }
        pushToast(`${listing.itemName} 매물을 취소했습니다.`);
        setRefresh((v) => v + 1);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "취소 실패";
        setError(msg);
        pushToast(msg);
      }
    },
    [remote, pushToast, addEquipment, addMaterial],
  );

  return (
    <div className="space-y-3">
      <Card padding="sm">
        <div className="flex items-center justify-between gap-2">
          <TabBar
            tabs={SUB_TABS}
            active={sub}
            onChange={setSub}
            ariaLabel="거래소 하위 탭"
            size="sm"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setModal(true)}
            className="shrink-0 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            매물 등록
          </button>
        </div>
        {inboxCount !== null && inboxCount > 0 ? (
          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            📬 마을 우편함에 수령 대기 {inboxCount}건이 있습니다.
          </div>
        ) : null}
      </Card>

      {error ? (
        <Card padding="sm">
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        </Card>
      ) : null}

      <ListingsView
        refreshKey={refresh}
        onCancelListing={onCancel}
        onBuyListing={onBuy}
        mineOnly={sub === "mine"}
      />

      {modal ? (
        <ListingCreateModal
          inventory={inventory}
          equipped={equipped}
          remote={remote}
          onClose={() => setModal(false)}
          onSuccess={() => {
            setModal(false);
            setRefresh((v) => v + 1);
            pushToast("매물을 등록했습니다.");
          }}
          onLocalDeduct={(s, qty) => {
            if (s.kind === "equip") {
              consumeEquipment(s.itemId as ItemId, 1);
            } else {
              consumeMaterial(s.itemId as MaterialId, qty);
            }
          }}
          showError={(msg) => {
            setError(msg);
            pushToast(msg);
          }}
        />
      ) : null}

    </div>
  );
}

