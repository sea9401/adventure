import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// DATABASE_URL 은 Vercel Marketplace 의 Neon Postgres 통합이 자동 주입.
// 로컬 개발은 `vercel env pull .env.development.local` 후 사용.
function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.development.local` after installing Neon on Vercel Marketplace.",
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

// 호출 시점에 환경변수를 검증. 빌드 타임에는 import 만 되고 실제 연결은 안 함.
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_, prop) {
    const real = getDb();
    return Reflect.get(real, prop);
  },
});

export { schema };
