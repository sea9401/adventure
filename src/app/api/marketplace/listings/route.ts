import { and, asc, count, desc, eq, ilike, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  marketplaceListings,
  marketplaceInbox,
  savesKv,
  users,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  MARKETPLACE_PRICE_MAX,
  MARKETPLACE_PRICE_MIN,
  MARKETPLACE_SLOT_LIMIT,
  addToCategory,
  deductFromCategory,
  getEquippedItemIds,
  getItemName,
  isItemKind,
  isTradable,
  type InventoryShape,
} from "@/lib/server/marketplace";

const SAVES_INVENTORY = "inventory.v2";
const SAVES_CHARACTER = "character.v2";
const SAVES_PROFILE = "character-profile.v2";

// ─────────────────────────────────────────────────────────────────────
// GET /api/marketplace/listings — 검색
//   q       (선택) item_name ILIKE %q%
//   kind    (선택) 'equip' | 'material'
//   sort    'price_asc' | 'price_desc' | 'recent'
//   mine    (선택) '1' 이면 내 것만
//   cursor  (선택) "<created_at_iso>:<id>" — 이전 페이지 마지막 row
//   limit   기본 30, 최대 50
// ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const kindParam = url.searchParams.get("kind");
  const sortParam = url.searchParams.get("sort");
  const VALID_SORTS = ["recent", "price_asc", "price_desc"] as const;
  type Sort = (typeof VALID_SORTS)[number];
  if (sortParam !== null && !(VALID_SORTS as readonly string[]).includes(sortParam)) {
    return new Response("invalid sort", { status: 400 });
  }
  const sort: Sort = (sortParam ?? "recent") as Sort;
  const mine = url.searchParams.get("mine") === "1";
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30),
  );
  const cursor = url.searchParams.get("cursor");

  const filters = [eq(marketplaceListings.status, "active")];
  if (kindParam) {
    if (!isItemKind(kindParam)) {
      return new Response("invalid kind", { status: 400 });
    }
    filters.push(eq(marketplaceListings.itemKind, kindParam));
  }
  if (q) filters.push(ilike(marketplaceListings.itemName, `%${q}%`));
  if (mine) filters.push(eq(marketplaceListings.sellerId, userId));

  if (cursor && sort === "recent") {
    const [iso, idStr] = cursor.split(":");
    const cursorDate = new Date(iso);
    const cursorId = Number(idStr);
    if (Number.isFinite(cursorId) && !Number.isNaN(cursorDate.getTime())) {
      filters.push(
        or(
          lt(marketplaceListings.createdAt, cursorDate),
          and(
            eq(marketplaceListings.createdAt, cursorDate),
            lt(marketplaceListings.id, cursorId),
          ),
        )!,
      );
    }
  }

  const orderBy =
    sort === "price_asc"
      ? [asc(marketplaceListings.price), desc(marketplaceListings.id)]
      : sort === "price_desc"
        ? [desc(marketplaceListings.price), desc(marketplaceListings.id)]
        : [desc(marketplaceListings.createdAt), desc(marketplaceListings.id)];

  const rows = await db
    .select()
    .from(marketplaceListings)
    .where(and(...filters))
    .orderBy(...orderBy)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last && sort === "recent"
      ? `${last.createdAt.toISOString()}:${last.id}`
      : null;

  return Response.json({
    items: items.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      sellerName: r.sellerName,
      isMine: r.sellerId === userId,
      itemKind: r.itemKind,
      itemId: r.itemId,
      itemName: r.itemName,
      quantity: r.quantity,
      price: r.price,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  });
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/marketplace/listings — 등록 (인벤 차감 + escrow)
//   body: { itemKind, itemId, quantity, price }
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: {
    itemKind?: unknown;
    itemId?: unknown;
    quantity?: unknown;
    price?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const itemKind = body.itemKind;
  const itemId = body.itemId;
  const quantity = Number(body.quantity);
  const price = Number(body.price);

  if (typeof itemKind !== "string" || !isItemKind(itemKind)) {
    return new Response("invalid itemKind", { status: 400 });
  }
  if (typeof itemId !== "string" || !itemId) {
    return new Response("invalid itemId", { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return new Response("invalid quantity", { status: 400 });
  }
  if (
    !Number.isInteger(price) ||
    price < MARKETPLACE_PRICE_MIN ||
    price > MARKETPLACE_PRICE_MAX
  ) {
    return new Response("invalid price", { status: 400 });
  }
  // 장비는 1개만 등록 가능 (스택 개념 없음 — 계정에 같은 장비 여러 개 있어도 따로 등록).
  if (itemKind === "equip" && quantity !== 1) {
    return new Response("equip quantity must be 1", { status: 400 });
  }

  const itemName = getItemName(itemKind, itemId);
  if (!itemName) {
    return new Response("unknown item", { status: 400 });
  }
  if (!isTradable(itemKind, itemId)) {
    return new Response("not tradable", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 슬롯 한도 확인 — 활성 listing 카운트.
      const [slotRow] = await tx
        .select({ n: count() })
        .from(marketplaceListings)
        .where(
          and(
            eq(marketplaceListings.sellerId, userId),
            eq(marketplaceListings.status, "active"),
          ),
        );
      if ((slotRow?.n ?? 0) >= MARKETPLACE_SLOT_LIMIT) {
        return { error: "slot_limit", status: 400 as const };
      }

      // 인벤토리 행을 잠금. 아직 한 번도 동기화 안 한 유저면 행 자체가 없음 → 빈 인벤.
      const invRows = await tx
        .select()
        .from(savesKv)
        .where(and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_INVENTORY)))
        .for("update");

      const inv = (invRows[0]?.value ?? {}) as InventoryShape;

      // 장비 장착 중인지 확인 (장비만).
      if (itemKind === "equip") {
        const charRows = await tx
          .select()
          .from(savesKv)
          .where(
            and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_CHARACTER)),
          );
        const equippedIds = getEquippedItemIds(charRows[0]?.value ?? null);
        if (equippedIds.has(itemId)) {
          return { error: "equipped", status: 400 as const };
        }
      }

      const categoryKey = itemKind === "equip" ? "equipment" : "materials";
      const next = deductFromCategory(inv[categoryKey], itemId, quantity);
      if (next === null) {
        return { error: "insufficient", status: 400 as const };
      }
      const nextInv: InventoryShape = { ...inv, [categoryKey]: next };

      // 인벤토리 업데이트 — upsert (아직 행이 없을 수도).
      await tx
        .insert(savesKv)
        .values({
          userId,
          key: SAVES_INVENTORY,
          value: nextInv,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [savesKv.userId, savesKv.key],
          set: { value: nextInv, updatedAt: new Date() },
        });

      // seller name 스냅샷 — users.name 우선, 없으면 character-profile.v2.name, 그것도
      // 없으면 default.
      let sellerName: string | null = null;
      const [u] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (u?.name) sellerName = u.name;
      if (!sellerName) {
        const [profRow] = await tx
          .select({ value: savesKv.value })
          .from(savesKv)
          .where(
            and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_PROFILE)),
          );
        const profileName = (profRow?.value as { name?: unknown } | null)?.name;
        if (typeof profileName === "string") sellerName = profileName;
      }
      if (!sellerName) sellerName = "모험가";

      const [inserted] = await tx
        .insert(marketplaceListings)
        .values({
          sellerId: userId,
          sellerName,
          itemKind,
          itemId,
          itemName,
          quantity,
          price,
        })
        .returning();

      return { ok: true as const, listing: inserted, inventory: nextInv };
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }

    return Response.json({
      ok: true,
      listing: {
        id: result.listing.id,
        itemKind: result.listing.itemKind,
        itemId: result.listing.itemId,
        itemName: result.listing.itemName,
        quantity: result.listing.quantity,
        price: result.listing.price,
        createdAt: result.listing.createdAt.toISOString(),
      },
      inventory: result.inventory,
    });
  } catch (e) {
    console.error("[marketplace.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/marketplace/listings?id=N — 취소 (escrow 환불)
// 환불은 직접 인벤토리에 복귀 (등록자 본인이 active 액션이라 race window 작음 +
// 응답 스냅샷을 클라가 적용한 뒤 다시 patch 하는 패턴).
// ─────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const idStr = url.searchParams.get("id");
  const listingId = Number(idStr);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [listing] = await tx
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.id, listingId))
        .for("update");

      if (!listing) return { error: "not_found", status: 404 as const };
      if (listing.sellerId !== userId) {
        return { error: "forbidden", status: 403 as const };
      }
      if (listing.status !== "active") {
        return { error: "not_active", status: 409 as const };
      }

      const update = await tx
        .update(marketplaceListings)
        .set({ status: "cancelled", closedAt: new Date() })
        .where(
          and(
            eq(marketplaceListings.id, listingId),
            eq(marketplaceListings.status, "active"),
          ),
        )
        .returning({ id: marketplaceListings.id });
      if (update.length === 0) {
        return { error: "race", status: 409 as const };
      }

      // 인벤토리 환불.
      const invRows = await tx
        .select()
        .from(savesKv)
        .where(and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_INVENTORY)))
        .for("update");
      const inv = (invRows[0]?.value ?? {}) as InventoryShape;
      const categoryKey = listing.itemKind === "equip" ? "equipment" : "materials";
      const next = addToCategory(inv[categoryKey], listing.itemId, listing.quantity);
      const nextInv: InventoryShape = { ...inv, [categoryKey]: next };

      await tx
        .insert(savesKv)
        .values({
          userId,
          key: SAVES_INVENTORY,
          value: nextInv,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [savesKv.userId, savesKv.key],
          set: { value: nextInv, updatedAt: new Date() },
        });

      // 우편함 row 도 남겨 추후 거래 이력/감사용 (수령 자동 — 이미 인벤 반영됨).
      await tx.insert(marketplaceInbox).values({
        userId,
        kind: "cancel_return",
        payload: {
          item_kind: listing.itemKind,
          item_id: listing.itemId,
          quantity: listing.quantity,
        },
        message: `${listing.itemName} 등록 취소 — 인벤토리로 환불`,
        listingId: listing.id,
        claimedAt: new Date(), // 자동 수령 처리 (취소는 본인이 클릭해 즉시 반영)
      });

      return { ok: true as const, inventory: nextInv };
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return Response.json({ ok: true, inventory: result.inventory });
  } catch (e) {
    console.error("[marketplace.DELETE] ", e);
    return new Response("internal error", { status: 500 });
  }
}
