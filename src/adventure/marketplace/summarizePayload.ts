import { ITEMS, type ItemId } from "@/adventure/data/items";
import { craftTierSuffix, type CraftTier } from "@/adventure/data/craftQuality";
import { dropQualityPrefix, type DropQuality } from "@/adventure/data/dropQuality";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { getRecipeById } from "@/adventure/data/recipes";
import { parseInboxPayload } from "@/lib/server/inboxPayload";
import type { InboxItem } from "./api";

// payload.grade ("base"|"c±N"|"dN") → "정교한 야구방망이 ⟨고급⟩" 식 풀 라벨.
// grade "base" → baseName 그대로.
function gradedEquipName(baseName: string, grade: string): string {
  if (grade === "base") return baseName;
  let tier: CraftTier | undefined;
  let quality: DropQuality | undefined;
  if (grade === "c-2" || grade === "c-1" || grade === "c1" || grade === "c2") {
    tier = Number(grade.slice(1)) as CraftTier;
  } else if (grade === "d1" || grade === "d2") {
    quality = Number(grade.slice(1)) as DropQuality;
  }
  return `${dropQualityPrefix(quality)}${baseName}${craftTierSuffix(tier)}`;
}

export function summarizePayload(item: InboxItem): string {
  // payload shape 가 어긋난 우편 (마이그레이션 잔재, 코드 버그 등) → 친절한 fallback.
  const parsed = parseInboxPayload(item.kind, item.payload);
  if (!parsed) return "(알 수 없는 우편)";

  switch (parsed.kind) {
    case "user_message": {
      const from = item.fromName ?? "알 수 없는 발신자";
      return `✉️ ${from} 의 쪽지`;
    }
    case "sale_proceeds":
      return `🪙 판매 대금 ${parsed.gold.toLocaleString()} G`;
    case "recipe_gift": {
      const name = getRecipeById(parsed.recipe_id)?.name ?? parsed.recipe_name;
      const from = item.fromName ?? "알 수 없는 발신자";
      return `📜 ${from} 의 제작서 선물 — ${name}`;
    }
    case "listing_expired": {
      const name = displayItemName(
        parsed.item_kind,
        parsed.item_id,
        parsed.grade,
      );
      return `⏰ 매물 회수 — ${name}${parsed.quantity > 1 ? ` ×${parsed.quantity}` : ""}`;
    }
    case "guild_invite": {
      const from = item.fromName ?? "알 수 없는 발신자";
      return `🤝 ${from} 의 길드 초대 — ${parsed.guild_name}`;
    }
    case "guild_quest_reward":
      return `🏆 길드 의뢰 보상 — ${parsed.quest_name}${
        parsed.gold > 0 ? ` (+${parsed.gold.toLocaleString()} G)` : ""
      }`;
    case "purchase_item":
    case "cancel_return": {
      const name = displayItemName(
        parsed.item_kind,
        parsed.item_id,
        parsed.grade,
      );
      const prefix =
        parsed.kind === "purchase_item"
          ? parsed.item_kind === "recipe"
            ? "📜 구매한 제작서"
            : "🎁 구매한 아이템"
          : "↩️ 환불";
      return `${prefix} — ${name}${parsed.quantity > 1 ? ` ×${parsed.quantity}` : ""}`;
    }
  }
}

function displayItemName(
  itemKind: "equip" | "material" | "recipe" | "skill_book",
  itemId: string,
  grade: string,
): string {
  switch (itemKind) {
    case "equip":
      return gradedEquipName(ITEMS[itemId as ItemId]?.name ?? itemId, grade);
    case "material":
      return MATERIALS[itemId as MaterialId]?.name ?? itemId;
    case "recipe":
      return getRecipeById(itemId)?.name ?? itemId;
    case "skill_book":
      return itemId;
  }
}
