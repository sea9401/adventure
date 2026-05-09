import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceInbox, savesKv } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  addToCategory,
  type InventoryShape,
} from "@/lib/server/marketplace";

const SAVES_CHARACTER = "character.v2";
const SAVES_INVENTORY = "inventory.v2";

type AddItem = {
  kind: "equip" | "material";
  id: string;
  quantity: number;
};

// POST /api/marketplace/inbox/claim
//   body: { ids: number[] }
// 트랜잭션 단위:
//   1) 지정 inbox 행을 claimed_at IS NULL 조건으로 잠금
//   2) gold/items 집계
//   3) character.v2 / inventory.v2 잠금 + 갱신
//   4) inbox claimed_at = NOW
// 응답: 새 골드, 새 인벤토리, 추가된 항목 — 클라이언트가 즉시 반영.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { ids?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const rawIds = body.ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return new Response("missing ids", { status: 400 });
  }
  const ids = rawIds
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) {
    return new Response("invalid ids", { status: 400 });
  }
  // 한 번에 처리 가능한 수량 제한 — 비정상적으로 큰 batch 차단.
  if (ids.length > 100) {
    return new Response("too many ids", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(marketplaceInbox)
        .where(
          and(
            eq(marketplaceInbox.userId, userId),
            inArray(marketplaceInbox.id, ids),
            isNull(marketplaceInbox.claimedAt),
          ),
        )
        .for("update");

      if (rows.length === 0) {
        return { error: "no_unclaimed", status: 404 as const };
      }

      let goldTotal = 0;
      const itemsToAdd: AddItem[] = [];
      for (const row of rows) {
        const payload = row.payload as Record<string, unknown>;
        // user_message: 부수효과 없음 — claimedAt 만 마킹되고 사라진다.
        if (row.kind === "sale_proceeds") {
          const g = Number(payload.gold);
          if (Number.isFinite(g) && g > 0) goldTotal += g;
        } else if (
          row.kind === "purchase_item" ||
          row.kind === "cancel_return"
        ) {
          const k = payload.item_kind;
          const id = payload.item_id;
          const q = Number(payload.quantity);
          if (
            (k === "equip" || k === "material") &&
            typeof id === "string" &&
            Number.isFinite(q) &&
            q > 0
          ) {
            itemsToAdd.push({ kind: k, id, quantity: q });
          }
        }
      }

      // 캐릭터 골드 갱신 (있을 때만).
      let newGold: number | null = null;
      if (goldTotal > 0) {
        const charRows = await tx
          .select()
          .from(savesKv)
          .where(
            and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_CHARACTER)),
          )
          .for("update");
        if (charRows.length === 0) {
          return { error: "no_character", status: 400 as const };
        }
        const character = charRows[0].value as Record<string, unknown>;
        const cur = Number((character as { gold?: unknown }).gold ?? 0);
        newGold = cur + goldTotal;
        const nextChar = { ...character, gold: newGold };
        await tx
          .update(savesKv)
          .set({ value: nextChar, updatedAt: new Date() })
          .where(
            and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_CHARACTER)),
          );
      }

      // 인벤토리 갱신 (아이템 있을 때만).
      let newInventory: InventoryShape | null = null;
      if (itemsToAdd.length > 0) {
        const invRows = await tx
          .select()
          .from(savesKv)
          .where(
            and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_INVENTORY)),
          )
          .for("update");
        const inv = (invRows[0]?.value ?? {}) as InventoryShape;
        let next: InventoryShape = { ...inv };
        for (const it of itemsToAdd) {
          const categoryKey = it.kind === "equip" ? "equipment" : "materials";
          next = {
            ...next,
            [categoryKey]: addToCategory(next[categoryKey], it.id, it.quantity),
          };
        }
        await tx
          .insert(savesKv)
          .values({
            userId,
            key: SAVES_INVENTORY,
            value: next,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [savesKv.userId, savesKv.key],
            set: { value: next, updatedAt: new Date() },
          });
        newInventory = next;
      }

      // inbox 마킹.
      const now = new Date();
      await tx
        .update(marketplaceInbox)
        .set({ claimedAt: now })
        .where(
          and(
            eq(marketplaceInbox.userId, userId),
            inArray(
              marketplaceInbox.id,
              rows.map((r) => r.id),
            ),
            isNull(marketplaceInbox.claimedAt),
          ),
        );

      return {
        ok: true as const,
        claimed: rows.map((r) => r.id),
        goldAdded: goldTotal,
        itemsAdded: itemsToAdd,
        newGold,
        newInventory,
      };
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[marketplace.inbox.claim] ", e);
    return new Response("internal error", { status: 500 });
  }
}
