"use client";

import { ITEMS, rarityTextClass } from "@/adventure/data/items";
import { POTIONS } from "@/adventure/data/potions";
import { MATERIALS } from "@/adventure/data/materials";
import { craftTierSuffix } from "@/adventure/data/craftQuality";
import type { Recipe } from "@/adventure/data/recipes";
import { craftErrorMessage, type CraftResult } from "@/adventure/crafting/types";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useInventory } from "@/adventure/inventory/useInventory";
import { useRemoteSave } from "@/lib/storage/SaveProvider";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";

// 제작 — 서버 권위. 클라는 recipeId 만 보내고, 서버가 inventory.v2 / crafting.v2 를 잠그고
// 검증·적용(품질 등급 추첨 포함)한 새 값을 받아 in-memory state 를 replace.
// 사전 검사(재료/포션 한도)는 UX 용 — 라운드트립 전에 부족분을 안내. 권한은 서버가 갖는다.
export function useCraftAction(deps: {
  inventory: ReturnType<typeof useInventory>;
  crafting: ReturnType<typeof useCrafting>;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
  grantTitle: (titleId: string) => void;
}) {
  const { inventory, crafting, addNotification, grantTitle } = deps;
  const remote = useRemoteSave();

  const handleCraft = async (recipe: Recipe) => {
    for (const ing of recipe.ingredients) {
      if (ing.kind === "material") {
        if (inventory.materialCount(ing.materialId) < ing.count) {
          addNotification(
            "info",
            `재료가 부족하다 — ${MATERIALS[ing.materialId].name} ${ing.count}개 필요.`,
          );
          return;
        }
      } else {
        const have =
          (inventory.state.equipment[ing.itemId] ?? 0) +
          inventory.craftedTotalCount(ing.itemId) +
          inventory.droppedTotalCount(ing.itemId);
        if (have < ing.count) {
          addNotification(
            "info",
            `재료가 부족하다 — ${ITEMS[ing.itemId].name} ${ing.count}개 필요.`,
          );
          return;
        }
      }
    }
    if (recipe.result.kind === "potion") {
      const have = inventory.state.potions[recipe.result.potionId] ?? 0;
      if (have + recipe.result.quantity > inventory.potionMax) {
        addNotification(
          "info",
          `${POTIONS[recipe.result.potionId].name}을(를) 더 들 수 없다.`,
        );
        return;
      }
    }

    // 서버가 inventory.v2 / crafting.v2 를 read-modify-write 하므로, 디바운스 큐의
    // 로컬 PATCH(방금 주운 드랍 등)를 먼저 flush 해 서버가 최신 값에서 차감하게 한다.
    // (안 하면 stale 값 적용 → replaceFromSaved 가 덮어쓰고 → 뒤늦은 PATCH 가 409→재시도로
    //  덮인 값을 다시 올려 드랍이 영구 유실. 마켓플레이스와 동일한 처리.)
    await remote.flush();
    let res: Response;
    try {
      res = await fetch("/api/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id }),
      });
    } catch {
      addNotification("info", "통신 오류 — 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (res.status === 401 || res.status === 410) return;
    const data = (await res.json().catch(() => null)) as
      | { ok: true; inventory: unknown; crafting: unknown; result: CraftResult }
      | { ok: false; error: string }
      | null;
    if (!data) {
      addNotification("info", "제작에 실패했다.");
      return;
    }
    if (data.ok === false) {
      addNotification("info", craftErrorMessage(data.error));
      return;
    }
    inventory.replaceFromSaved(data.inventory);
    crafting.replaceFromSaved(data.crafting);

    if (data.result.kind === "equipment") {
      const item = ITEMS[data.result.itemId];
      const suffix = craftTierSuffix(data.result.tier);
      addNotification("item", `${item.name}${suffix}을(를) 만들었다.`, {
        highlight: { name: item.name + suffix, className: rarityTextClass(item) },
      });
      // 제작 등급 칭호 — 걸작(2): 명장 / 불량(-2): 불량품 제작자.
      if (data.result.tier === 2) grantTitle("masterwork");
      if (data.result.tier === -2) grantTitle("botched");
    } else {
      const potion = POTIONS[data.result.potionId];
      const qty = data.result.quantity;
      addNotification(
        "item",
        qty > 1
          ? `${potion.name} ×${qty}을(를) 만들었다.`
          : `${potion.name}을(를) 만들었다.`,
      );
    }
  };

  return { handleCraft };
}
