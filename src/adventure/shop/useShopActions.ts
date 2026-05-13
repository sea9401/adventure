"use client";

import type { Dispatch, SetStateAction } from "react";
import { WORLD_MAP, type RegionId } from "@/adventure/data/world";
import { ITEMS, type ItemId } from "@/adventure/data/items";
import { POTIONS, type PotionId } from "@/adventure/data/potions";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { type ConsumableId } from "@/adventure/data/consumables";
import { craftTierSuffix, type CraftTier } from "@/adventure/data/craftQuality";
import {
  dropQualityPrefix,
  type DropQuality,
} from "@/adventure/data/dropQuality";
import type { ShopActionKind, ShopOutcome } from "@/adventure/shop/types";
import type { useCharacterState } from "@/adventure/character/useCharacterState";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useShopUnlocks } from "@/adventure/shop/useShopUnlocks";
import type { MapProgress } from "@/lib/map-progress";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";

// /api/shop 의 ShopError code → 사용자 안내 문구.
function shopErrorMessage(code: string): string {
  switch (code) {
    case "insufficient_gold":
      return "골드가 부족하다.";
    case "full":
      return "더 들 수 없다.";
    case "insufficient_items":
      return "보유량이 부족하다.";
    case "locked":
      return "아직 상점에서 취급하지 않는 재료다.";
    default:
      return "상점 처리에 실패했다.";
  }
}

// 상점 buy/sell + 마을 귀환 주문서 핸들러 묶음. 상점/제작/장비는 서버 권위 —
// 클라는 의도만 보내고, 서버가 character.v2 / inventory.v2 를 잠그고 검증·적용한
// 새 값을 받아 in-memory state 를 replace. 이어지는 useRemotePatch 가 409→재시도로 수렴.
export function useShopActions(deps: {
  characterStateHook: ReturnType<typeof useCharacterState>;
  inventory: ReturnType<typeof useInventory>;
  shopUnlocks: ReturnType<typeof useShopUnlocks>;
  mapProgress: MapProgress;
  setMapProgress: Dispatch<SetStateAction<MapProgress>>;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
  grantTitle: (titleId: string) => void;
}) {
  const {
    characterStateHook,
    inventory,
    shopUnlocks,
    mapProgress,
    setMapProgress,
    addNotification,
    grantTitle,
  } = deps;

  const runShopAction = async (body: {
    kind: ShopActionKind;
    id: string;
    quantity: number;
    craftTier?: number;
    dropQuality?: number;
  }): Promise<{ applied: ShopOutcome["applied"] } | null> => {
    if (!Number.isInteger(body.quantity) || body.quantity < 1) return null;
    let res: Response;
    try {
      res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      addNotification("info", "통신 오류 — 잠시 후 다시 시도해 주세요.");
      return null;
    }
    if (res.status === 401 || res.status === 410) {
      // 세션 만료/무효 — 다음 저장 시도에서 SaveProvider 가 안내. 여기선 조용히 실패.
      return null;
    }
    const data = (await res.json().catch(() => null)) as
      | {
          ok: true;
          character: unknown;
          inventory: unknown;
          applied: ShopOutcome["applied"];
        }
      | { ok: false; error: string }
      | null;
    if (!data) {
      addNotification("info", "상점 처리에 실패했다.");
      return null;
    }
    if (data.ok === false) {
      addNotification("info", shopErrorMessage(data.error));
      return null;
    }
    characterStateHook.replaceFromSaved(data.character);
    inventory.replaceFromSaved(data.inventory);
    return { applied: data.applied };
  };

  const handlePurchasePotion = async (id: PotionId, quantity: number) => {
    await runShopAction({ kind: "buy_potion", id, quantity });
  };

  const handlePurchaseMaterial = async (id: MaterialId, quantity: number) => {
    await runShopAction({ kind: "buy_material", id, quantity });
  };

  const handlePurchaseConsumable = async (
    id: ConsumableId,
    quantity: number,
  ) => {
    await runShopAction({ kind: "buy_consumable", id, quantity });
  };

  const handlePurchaseEquipment = async (id: ItemId, quantity: number) => {
    const r = await runShopAction({ kind: "buy_equipment", id, quantity });
    if (!r) return;
    addNotification(
      "info",
      `${ITEMS[id].name}${quantity > 1 ? ` ×${quantity}` : ""}을(를) 샀다.`,
    );
  };

  // 마을 귀환 주문서 사용 — 가본 마을로 즉시 이동.
  // 마을→마을은 무소비 (지도 fast-travel 과 동일), 그 외엔 1개 소비.
  const handleUseTownReturn = (townId: RegionId): boolean => {
    const target = WORLD_MAP.regions.find((r) => r.id === townId);
    if (!target?.tags?.includes("town")) return false;
    if (!mapProgress.visitedRegionIds.includes(townId)) return false;
    if (mapProgress.currentRegionId === townId) return false;
    const from = WORLD_MAP.regions.find(
      (r) => r.id === mapProgress.currentRegionId,
    );
    const fromIsTown = !!from?.tags?.includes("town");
    if (!fromIsTown) {
      if (!inventory.consumeConsumable("scroll_town_return", 1)) return false;
    }
    setMapProgress((prev) => ({ ...prev, currentRegionId: townId }));
    addNotification(
      "info",
      fromIsTown
        ? `${target.name}(으)로 이동했다.`
        : `귀환 주문서로 ${target.name}(으)로 이동했다.`,
    );
    return true;
  };

  // 판매 — 서버가 인벤토리에서 차감 + 골드 지급. 0G 아이템은 단순 정리(버리기) 효과.
  // 토스트/칭호/해금 알림은 서버가 알려준 applied(실제 적용 수량·골드)로 구성.
  const handleSellPotion = async (id: PotionId, quantity: number) => {
    const r = await runShopAction({ kind: "sell_potion", id, quantity });
    if (!r) return;
    const { quantity: qty, goldDelta: total } = r.applied;
    addNotification(
      "info",
      total > 0
        ? `${POTIONS[id].name} ×${qty}을(를) ${total}G에 팔았다.`
        : `${POTIONS[id].name} ×${qty}을(를) 버렸다.`,
    );
  };

  const handleSellMaterial = async (id: MaterialId, quantity: number) => {
    const r = await runShopAction({ kind: "sell_material", id, quantity });
    if (!r) return;
    const { quantity: qty, goldDelta: total } = r.applied;
    addNotification(
      "info",
      total > 0
        ? `${MATERIALS[id].name} ×${qty}을(를) ${total}G에 팔았다.`
        : `${MATERIALS[id].name} ×${qty}을(를) 버렸다.`,
    );
    // 누적 판매량 100 도달 시 상점에서 구매 가능. 처음 도달한 순간만 알림.
    // 임계치를 처음 넘긴 시점에 '상인' 칭호도 함께 부여 (이미 보유면 idempotent).
    // shop.unlocks.v1 은 진행 마커라 클라 권위 유지 (server-authority-plan v1 비대상) —
    // 서버 material-buy 검증은 이 PATCH 가 동기화된 값을 read-only 로 본다.
    const crossed = shopUnlocks.recordSale(id, qty);
    if (crossed) {
      addNotification(
        "info",
        `상점에서 ${MATERIALS[id].name}을(를) 취급하기 시작했다.`,
      );
      grantTitle("merchant");
    }
  };

  const handleSellEquipment = async (
    id: ItemId,
    quantity: number,
    craftTier?: CraftTier,
    dropQuality?: DropQuality,
  ) => {
    const r = await runShopAction({
      kind: "sell_equipment",
      id,
      quantity,
      craftTier,
      dropQuality,
    });
    if (!r) return;
    const { quantity: qty, goldDelta: total } = r.applied;
    const name =
      dropQualityPrefix(dropQuality) +
      ITEMS[id].name +
      craftTierSuffix(craftTier);
    addNotification(
      "info",
      total > 0
        ? `${name}${qty > 1 ? ` ×${qty}` : ""}을(를) ${total}G에 팔았다.`
        : `${name}${qty > 1 ? ` ×${qty}` : ""}을(를) 버렸다.`,
    );
    if (id === "mom_amulet") grantTitle("unfilial");
  };

  return {
    handlePurchasePotion,
    handlePurchaseMaterial,
    handlePurchaseConsumable,
    handlePurchaseEquipment,
    handleUseTownReturn,
    handleSellPotion,
    handleSellMaterial,
    handleSellEquipment,
  };
}
