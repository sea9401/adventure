import { and, eq } from "drizzle-orm";
import { guildJoinRequests } from "@/db/schema";
import type { DbExecutor } from "@/lib/server/savesKv";

// 유저가 길드에 들어가면(길드 생성 / 초대 수락 / 신청 수락) 남아 있던 pending 가입 신청을 정리.
// (스키마상 유저당 pending 1건만 존재하지만, 흐름마다 잊지 않게 한 곳에 모아 둔다.)
export async function cancelPendingJoinRequestsInTx(
  tx: DbExecutor,
  userId: string,
): Promise<void> {
  await tx
    .update(guildJoinRequests)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(guildJoinRequests.userId, userId),
        eq(guildJoinRequests.status, "pending"),
      ),
    );
}
