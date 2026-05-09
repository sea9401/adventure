import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceInbox } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

// GET /api/marketplace/inbox — 미수령 우편함 (전체).
// claimed_at IS NULL 만, created_at DESC.
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const rows = await db
    .select({
      id: marketplaceInbox.id,
      kind: marketplaceInbox.kind,
      payload: marketplaceInbox.payload,
      message: marketplaceInbox.message,
      listingId: marketplaceInbox.listingId,
      fromName: marketplaceInbox.fromName,
      createdAt: marketplaceInbox.createdAt,
    })
    .from(marketplaceInbox)
    .where(
      and(
        eq(marketplaceInbox.userId, userId),
        isNull(marketplaceInbox.claimedAt),
      ),
    )
    .orderBy(desc(marketplaceInbox.createdAt));

  return Response.json({
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      payload: r.payload,
      message: r.message,
      listingId: r.listingId,
      fromName: r.fromName,
      createdAt: r.createdAt.toISOString(),
    })),
    unclaimedCount: rows.length,
  });
}
