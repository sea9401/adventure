import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guildJoinRequests } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

// POST /api/guilds/requests/[requestId]/cancel — 신청자가 본인 pending 가입 신청 취소.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const { requestId: idStr } = await params;
  const requestId = Number(idStr);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(guildJoinRequests)
        .where(eq(guildJoinRequests.id, requestId))
        .for("update");
      const reqRow = rows[0];
      if (!reqRow) return { error: "request_not_found", status: 404 as const };
      if (reqRow.userId !== userId) {
        return { error: "not_requester", status: 403 as const };
      }
      if (reqRow.status !== "pending") {
        return { error: "request_not_pending", status: 409 as const };
      }
      await tx
        .update(guildJoinRequests)
        .set({ status: "cancelled" })
        .where(eq(guildJoinRequests.id, requestId));
      return { ok: true as const };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.requests.cancel.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
