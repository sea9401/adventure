import { ITEMS, type ItemId } from "@/adventure/data/items";
import { craftTierSuffix, type CraftTier } from "@/adventure/data/craftQuality";
import { dropQualityPrefix, type DropQuality } from "@/adventure/data/dropQuality";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { getRecipeById } from "@/adventure/data/recipes";
import type { InboxItem } from "./api";

// payload.grade ("base"|"c±N"|"dN") → "정교한 야구방망이 ⟨고급⟩" 식 풀 라벨.
// grade 없음/잘못된 값 → baseName 그대로.
function gradedEquipName(baseName: string, grade: unknown): string {
  if (typeof grade !== "string" || grade === "base") return baseName;
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
  const p = item.payload;
  if (item.kind === "user_message") {
    const from = item.fromName ?? "알 수 없는 발신자";
    return `✉️ ${from} 의 쪽지`;
  }
  if (item.kind === "sale_proceeds") {
    const g = Number((p as { gold?: unknown }).gold ?? 0);
    return `🪙 판매 대금 ${g.toLocaleString()} G`;
  }
  if (item.kind === "recipe_gift") {
    const id = (p as { recipe_id?: unknown }).recipe_id;
    const name =
      typeof id === "string" ? (getRecipeById(id)?.name ?? id) : "제작서";
    const from = item.fromName ?? "알 수 없는 발신자";
    return `📜 ${from} 의 제작서 선물 — ${name}`;
  }
  if (item.kind === "listing_expired") {
    const kind = (p as { item_kind?: unknown }).item_kind;
    const id = (p as { item_id?: unknown }).item_id;
    const grade = (p as { grade?: unknown }).grade;
    const qty = Number((p as { quantity?: unknown }).quantity ?? 0);
    let name = typeof id === "string" ? id : "?";
    if (kind === "recipe" && typeof id === "string") {
      name = getRecipeById(id)?.name ?? id;
    } else if (kind === "equip" && typeof id === "string") {
      name = gradedEquipName(ITEMS[id as ItemId]?.name ?? id, grade);
    } else if (kind === "material" && typeof id === "string") {
      name = MATERIALS[id as MaterialId]?.name ?? id;
    }
    return `⏰ 매물 회수 — ${name}${qty > 1 ? ` ×${qty}` : ""}`;
  }
  if (item.kind === "guild_invite") {
    const guildName =
      typeof (p as { guild_name?: unknown }).guild_name === "string"
        ? (p as { guild_name: string }).guild_name
        : "?";
    const from = item.fromName ?? "알 수 없는 발신자";
    return `🤝 ${from} 의 길드 초대 — ${guildName}`;
  }
  if (item.kind === "guild_quest_reward") {
    const name =
      typeof (p as { quest_name?: unknown }).quest_name === "string"
        ? (p as { quest_name: string }).quest_name
        : "길드 의뢰";
    const g = Number((p as { gold?: unknown }).gold ?? 0);
    return `🏆 길드 의뢰 보상 — ${name}${g > 0 ? ` (+${g.toLocaleString()} G)` : ""}`;
  }
  if (item.kind === "purchase_item" || item.kind === "cancel_return") {
    const kind = (p as { item_kind?: unknown }).item_kind;
    const id = (p as { item_id?: unknown }).item_id;
    const grade = (p as { grade?: unknown }).grade;
    const qty = Number((p as { quantity?: unknown }).quantity ?? 1);
    let name = typeof id === "string" ? id : "?";
    if (kind === "equip" && typeof id === "string") {
      name = gradedEquipName(ITEMS[id as ItemId]?.name ?? id, grade);
    } else if (kind === "material" && typeof id === "string") {
      name = MATERIALS[id as MaterialId]?.name ?? id;
    } else if (kind === "recipe" && typeof id === "string") {
      name = getRecipeById(id)?.name ?? id;
    }
    const prefix =
      item.kind === "purchase_item"
        ? kind === "recipe"
          ? "📜 구매한 제작서"
          : "🎁 구매한 아이템"
        : "↩️ 환불";
    return `${prefix} — ${name}${qty > 1 ? ` ×${qty}` : ""}`;
  }
  return "(알 수 없는 우편)";
}
