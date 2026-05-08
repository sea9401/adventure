import { sql } from "drizzle-orm";
import { db } from "@/db";

// 외부 cron(GitHub Actions)이 주기적으로 호출 — Neon 이 scale-to-zero 로 잠들지 않게 깨워둠.
// Authorization: Bearer <CRON_SECRET> 으로 외부 무단 호출 차단.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  await db.execute(sql`select 1`);
  return Response.json({ ok: true, at: Date.now() });
}
