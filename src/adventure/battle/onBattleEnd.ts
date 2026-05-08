import type { BattleEndPayload } from "@/adventure/BattleView";
import type { PotionId } from "@/adventure/data/potions";
import type { MaterialId } from "@/adventure/data/materials";
import type { ItemId } from "@/adventure/data/items";
import { MONSTERS } from "@/adventure/data/monsters";
import { MATERIALS } from "@/adventure/data/materials";
import { ITEMS } from "@/adventure/data/items";
import { START_REGION_ID } from "@/adventure/data/world";
import { getQuestById } from "@/adventure/data/quests";
import type { MapProgress } from "@/lib/map-progress";
import type {
  NotificationKind,
  NotificationMeta,
} from "@/lib/notifications";
import type { TabKey } from "@/lib/useNavTabs";

export type BattleEndDeps = {
  inventory: {
    consume: (id: PotionId, n: number) => void;
    addMaterial: (id: MaterialId, n: number) => void;
    addEquipment: (id: ItemId) => void;
  };
  adventureLog: {
    addKill: (name: string) => void;
    markTitleObtained: (titleId: string) => void;
    incrementBattleLosses: () => void;
  };
  quests: { recordKill: (name: string) => string[] };
  characterState: {
    setHp: (n: number) => void;
    addExp: (exp: number, vit: number) => void;
    addGoldFame: (gold: number, fame: number) => void;
  };
  vit: number;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
  setHuntingActive: (next: boolean) => void;
  replaceLocation: (tab: TabKey, subView: string | null) => void;
  setMapProgress: (updater: (prev: MapProgress) => MapProgress) => void;
};

// BattleView 의 onBattleEnd 콜백 본체. 의존성을 명시적으로 주입받는 형태로
// page.tsx 에서 분리 — 테스트 가능 + 거대한 컴포넌트 본체에서 빠져나옴.
export function onBattleEnd(
  payload: BattleEndPayload,
  deps: BattleEndDeps,
): void {
  // 전투 중 사용된 포션을 인벤토리에서 차감 (resolveBattle 은 가짜 잔량으로 시뮬했음).
  for (const [id, n] of Object.entries(payload.potionsConsumed)) {
    if (n) deps.inventory.consume(id as PotionId, n);
  }

  if (payload.outcome === "win") {
    deps.adventureLog.addKill(payload.enemyName);
    deps.adventureLog.markTitleObtained("first_blood");
    const readyQuestIds = deps.quests.recordKill(payload.enemyName);
    deps.characterState.setHp(payload.finalPlayerHp);
    deps.characterState.addExp(payload.rewards.exp, deps.vit);
    // 드롭 판정 — 몬스터의 drops 정의대로 확률 굴림.
    // kind 별로 인벤/골드/장비에 분배.
    const monster = MONSTERS[payload.enemyName];
    if (monster?.drops) {
      for (const drop of monster.drops) {
        if (Math.random() >= drop.chance) continue;
        if (drop.kind === "material") {
          deps.inventory.addMaterial(drop.materialId, 1);
          deps.addNotification(
            "info",
            `${MATERIALS[drop.materialId].name}을(를) 손에 넣었다.`,
          );
        } else if (drop.kind === "gold") {
          deps.characterState.addGoldFame(drop.amount, 0);
          deps.addNotification("info", `골드 +${drop.amount}`);
        } else if (drop.kind === "equip") {
          deps.inventory.addEquipment(drop.itemId);
          deps.addNotification(
            "info",
            `${ITEMS[drop.itemId].name}을(를) 손에 넣었다!`,
          );
        }
      }
    }
    const reward =
      payload.rewards.exp > 0 ? `EXP +${payload.rewards.exp}` : "보상 없음";
    deps.addNotification(
      "battle_win",
      `${payload.enemyName}을(를) 쓰러뜨렸다 — ${reward}`,
      { battleLog: payload.log },
    );
    for (const id of readyQuestIds) {
      const quest = getQuestById(id);
      if (quest) {
        deps.addNotification(
          "quest_ready",
          `의뢰 조건 달성 — ${quest.title}: 길드에서 보상을 받을 수 있다.`,
        );
      }
    }
    return;
  }

  // 패배 — HP 0 + 시작 마을 강제 이동 + 마을 탭 치료소 sub 로 점프 + 자동 사냥 해제.
  // replace 로 history 에 남기지 않음 (사망 직후로 back 되돌아갈 일 없음).
  deps.adventureLog.incrementBattleLosses();
  deps.characterState.setHp(0);
  deps.setHuntingActive(false);
  deps.replaceLocation("town", "healing");
  deps.setMapProgress((prev) => ({
    currentRegionId: START_REGION_ID,
    visitedRegionIds: prev.visitedRegionIds.includes(START_REGION_ID)
      ? prev.visitedRegionIds
      : [...prev.visitedRegionIds, START_REGION_ID],
  }));
  deps.addNotification(
    "battle_lose",
    `${payload.enemyName}에게 쓰러졌다... 시작 마을 치유소에서 회복이 필요하다.`,
    { battleLog: payload.log },
  );
}
