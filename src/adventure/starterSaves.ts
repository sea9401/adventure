import { initialCharacterState } from "@/adventure/character/useCharacterState";
import { emptyInventory } from "@/adventure/inventory/useInventory";
import type { SyncedKey } from "@/lib/storage/synced-keys";

// 신규 유저용 starter 값 — SaveProvider 가 부트스트랩에서 서버에 키가 없는 경우 시드한다.
//
// 배경: useRemotePatch 는 첫 마운트의 patch 를 일부러 skip 한다 ("서버 값을 되받아 쓰는 의미
// 없는 호출" 회피). 그런데 신규 유저는 서버에 character.v2 / inventory.v2 가 아예 없어서
// 클라 default(initialCharacterState 의 gold 10, emptyInventory 의 시작 포션/재료)가 영영
// 서버로 안 박힌다. 그 상태에서 서버 권위 라우트(/api/shop, /api/craft 등) 가 호출되면
// character.v2 → null → gold 0, inventory → null → 빈 인벤으로 보고 insufficient_gold /
// insufficient_items 로 거절. 첫 진입 시 한 번 시드해서 차단.
export const STARTER_SAVES: Partial<Record<SyncedKey, unknown>> = {
  "character.v2": initialCharacterState,
  "inventory.v2": emptyInventory(),
};
