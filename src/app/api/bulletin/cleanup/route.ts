import { lt } from "drizzle-orm";
import { db } from "@/db";
import { bulletinPosts } from "@/db/schema";
import { BULLETIN_RETENTION_DAYS } from "@/lib/bulletin-config";

// Vercel Cron 으로 매일 호출. BULLETIN_RETENTION_DAYS 일 이상 지난 게시물 삭제.
// CRON_SECRET 으로 외부 호출 차단.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const cutoff = new Date(
    Date.now() - BULLETIN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const deleted = await db
    .delete(bulletinPosts)
    .where(lt(bulletinPosts.createdAt, cutoff))
    .returning({ id: bulletinPosts.id });

  return Response.json({ ok: true, deleted: deleted.length, cutoff });
}
