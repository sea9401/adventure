import { and, count, desc, eq, ilike, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  marketplaceInbox,
  marketplaceListings,
} from "@/db/schema";
import { requireAdmin } from "@/lib/server/isAdmin";
import { isItemKind } from "@/lib/server/marketplace";

// GET /api/admin/marketplace/listings
// 일반 라우트와 달리 status 필터 자유 (default: 전체).
//   q       (선택) item_name 또는 seller_name ILIKE
//   status  (선택) 'active'|'sold'|'cancelled' (없으면 전체)
//   kind    (선택) 'equip'|'material'
//   sellerId (선택) 특정 유저로 제한
//   cursor  "<created_at_iso>:<id>"
//   limit   기본 30, 최대 100
//
// 응답에 카운트 요약 포함 (active/sold/cancelled).
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate) return gate;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status");
  const kindParam = url.searchParams.get("kind");
  const sellerId = url.searchParams.get("sellerId");
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30),
  );

  const filters = [];
  if (status === "active" || status === "sold" || status === "cancelled") {
    filters.push(eq(marketplaceListings.status, status));
  } else if (status && status !== "all") {
    return new Response("invalid status", { status: 400 });
  }
  if (kindParam) {
    if (!isItemKind(kindParam)) {
      return new Response("invalid kind", { status: 400 });
    }
    filters.push(eq(marketplaceListings.itemKind, kindParam));
  }
  if (q) {
    filters.push(
      or(
        ilike(marketplaceListings.itemName, `%${q}%`),
        ilike(marketplaceListings.sellerName, `%${q}%`),
      )!,
    );
  }
  if (sellerId) {
    filters.push(eq(marketplaceListings.sellerId, sellerId));
  }
  if (cursor) {
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

  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(marketplaceListings)
    .where(where)
    .orderBy(desc(marketplaceListings.createdAt), desc(marketplaceListings.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? `${last.createdAt.toISOString()}:${last.id}`
      : null;

  // 카운트 요약 (status 별).
  const summaryRows = await db
    .select({
      status: marketplaceListings.status,
      n: count(),
    })
    .from(marketplaceListings)
    .groupBy(marketplaceListings.status);
  const summary: Record<string, number> = {};
  for (const r of summaryRows) summary[r.status] = Number(r.n);

  return Response.json({
    items: items.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      sellerName: r.sellerName,
      buyerId: r.buyerId,
      itemKind: r.itemKind,
      itemId: r.itemId,
      itemName: r.itemName,
      grade: r.grade,
      quantity: r.quantity,
      price: r.price,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    })),
    nextCursor,
    summary,
  });
}

// DELETE /api/admin/marketplace/listings?id=N
// 관리자 강제 취소 — seller_id 무관. active 만 가능.
// 환불은 일반 cancel 과 동일하게 cancel_return 우편함 생성 (수령 대기).
// 자동 수령 처리 안 함 — 판매자가 직접 마을에서 수령하게.
export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (gate) return gate;

  const url = new URL(req.url);
  const idStr = url.searchParams.get("id");
  const listingId = Number(idStr);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return new Response("invalid id", { status: 400 });
  }
  const note = (url.searchParams.get("note") ?? "").trim();

  try {
    const result = await db.transaction(async (tx) => {
      const [listing] = await tx
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.id, listingId))
        .for("update");

      if (!listing) return { error: "not_found", status: 404 as const };
      if (listing.status !== "active") {
        return { error: "not_active", status: 409 as const };
      }

      const updated = await tx
        .update(marketplaceListings)
        .set({ status: "cancelled", closedAt: new Date() })
        .where(
          and(
            eq(marketplaceListings.id, listingId),
            eq(marketplaceListings.status, "active"),
          ),
        )
        .returning({ id: marketplaceListings.id });
      if (updated.length === 0) {
        return { error: "race", status: 409 as const };
      }

      const message = note
        ? `[관리자 취소] ${listing.itemName} — ${note}`
        : `[관리자 취소] ${listing.itemName}`;

      await tx.insert(marketplaceInbox).values({
        userId: listing.sellerId,
        kind: "cancel_return",
        payload: {
          item_kind: listing.itemKind,
          item_id: listing.itemId,
          grade: listing.grade,
          quantity: listing.quantity,
        },
        message,
        listingId: listing.id,
        // 일반 cancel 은 본인이 누른 거라 자동 수령(claimed_at=NOW) 처리지만
        // 관리자 강제 취소는 판매자가 직접 마을에서 수령하게 미수령으로 둠.
      });

      return {
        ok: true as const,
        listingId: listing.id,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        itemName: listing.itemName,
      };
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[admin.marketplace.DELETE] ", e);
    return new Response("internal error", { status: 500 });
  }
}

