import { and, eq } from "drizzle-orm";
import { savesKv } from "@/db/schema";
import { upsertSave, type DbExecutor } from "./savesKv";

// character.v2 의 affiliation 필드를 트랜잭션 안에서 일관되게 갱신하는 헬퍼.
// 길드 가입/탈퇴/해체/위임 등 affiliation 변경이 일어나는 모든 흐름에서 호출.
// 캐릭터 row 가 아직 없으면 (계정 생성 직후 첫 save 전) noop — 클라이언트의
// 첫 PATCH 가 도달했을 때 길드 멤버십을 보고 직접 채워 넣도록 둠.
const SAVES_CHARACTER = "character.v2";
const NO_AFFILIATION = "무소속";

export async function setAffiliationInTx(
  tx: DbExecutor,
  userId: string,
  affiliation: string,
): Promise<void> {
  const rows = await tx
    .select()
    .from(savesKv)
    .where(and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_CHARACTER)));
  const row = rows[0];
  if (!row) return;
  const character = row.value as Record<string, unknown>;
  if (character.affiliation === affiliation) return;
  await upsertSave(tx, userId, SAVES_CHARACTER, {
    ...character,
    affiliation,
  });
}

export async function clearAffiliationInTx(
  tx: DbExecutor,
  userId: string,
): Promise<void> {
  await setAffiliationInTx(tx, userId, NO_AFFILIATION);
}

export { SAVES_CHARACTER, NO_AFFILIATION };
