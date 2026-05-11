import { sql } from "drizzle-orm";
import { db } from "@/db";
import { savesKv, users } from "@/db/schema";

const PROFILE_STORAGE_KEY = "character-profile.v2";

// 닉네임으로 유저 검색. 대소문자 무시 + character-profile.v2 (legacy) fallback.
// inbox/send 의 findRecipientByName 패턴을 공용화.
export async function findUserByName(
  name: string,
): Promise<{ id: string; name: string } | null> {
  const [u] = await db
    .select({ id: users.id, name: users.gameName })
    .from(users)
    .where(sql`lower(${users.gameName}) = lower(${name})`)
    .limit(1);
  if (u?.name) return { id: u.id, name: u.name };
  const [legacy] = await db
    .select({ userId: savesKv.userId, value: savesKv.value })
    .from(savesKv)
    .where(
      sql`${savesKv.key} = ${PROFILE_STORAGE_KEY} and lower(${savesKv.value}->>'name') = lower(${name})`,
    )
    .limit(1);
  const legacyName = (legacy?.value as { name?: unknown } | undefined)?.name;
  if (legacy && typeof legacyName === "string" && legacyName.length > 0) {
    return { id: legacy.userId, name: legacyName };
  }
  return null;
}
