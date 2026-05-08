import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

// neon-http 드라이버는 트랜잭션 미지원 — 거래소 등 트랜잭션 필요한 라우트가 깨졌다.
// neon-serverless (WebSocket Pool) 로 전환해 db.transaction() 지원.
// Node 22+ / Edge 는 globalThis.WebSocket 을 쓰지만, Node 20 등 환경 폴백으로 ws 주입.
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

// DATABASE_URL 은 Vercel Marketplace 의 Neon Postgres 통합이 자동 주입.
// 로컬 개발은 `vercel env pull .env.development.local` 후 사용.
let pool: Pool | null = null;
function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.development.local` after installing Neon on Vercel Marketplace.",
    );
  }
  pool = new Pool({ connectionString: url });
  return pool;
}

// 호출 시점에 환경변수를 검증. 빌드 타임에는 import 만 되고 실제 연결은 안 함.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    const real = drizzle(getPool(), { schema });
    return Reflect.get(real, prop);
  },
});

export { schema };
