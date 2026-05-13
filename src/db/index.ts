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
// drizzle 인스턴스는 lazy 1회 생성 후 캐시 — 매 프로퍼티 접근마다 새로 만들면
// 고 RPS 에서 무의미한 GC 부담이 쌓인다.
let cachedDb: ReturnType<typeof drizzle> | null = null;
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    if (!cachedDb) cachedDb = drizzle(getPool(), { schema });
    return Reflect.get(cachedDb, prop);
  },
});

// `@auth/drizzle-adapter` 는 `is(db, PgDatabase)` 로 dialect 를 판별하는데,
// 이 검사는 `Object.getPrototypeOf(value).constructor` 체인을 따라간다 — 위 Proxy 는
// 타깃이 `{}` 라 체인이 끊겨 "Unsupported database type" 으로 throw 된다.
// 어댑터에는 실제 drizzle 인스턴스를 넘긴다 (요청 시점에만 호출 → 빌드 타임 DATABASE_URL 불필요).
export function rawDb(): ReturnType<typeof drizzle> {
  return drizzle(getPool(), { schema });
}

export { schema };
