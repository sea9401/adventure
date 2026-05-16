import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// DATABASE_URL 은 EC2 의 .env.production.local 에서 주입.
// 로컬 개발은 .env.development.local 에 Aurora endpoint 작성.
let pool: Pool | null = null;
function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. .env.development.local 에 Aurora endpoint 작성 필요.",
    );
  }
  // Aurora / RDS 모두 TLS 강제. 같은 VPC 내부 통신이라 CA 검증 생략(rejectUnauthorized:false).
  // 외부 망에서 접근시키게 되면 RDS CA bundle 로 `ssl.ca` 채워야 함.
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
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
