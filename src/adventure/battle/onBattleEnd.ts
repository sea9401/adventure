import type { BattleEndPayload } from "@/adventure/BattleView";
import type { PotionId } from "@/adventure/data/potions";
import type { MaterialId } from "@/adventure/data/materials";
import type { ItemId } from "@/adventure/data/items";
import { MONSTERS } from "@/adventure/data/monsters";
import { MATERIALS } from "@/adventure/data/materials";
import { ITEMS, rarityTextClass } from "@/adventure/data/items";
import { WORLD_MAP, type RegionId } from "@/adventure/data/world";
import { getQuestById } from "@/adventure/data/quests";
import { getRecipeById } from "@/adventure/data/recipes";
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
  crafting: {
    knows: (id: string) => boolean;
    learnRecipe: (id: string) => void;
  };
  characterState: {
    setHp: (n: number) => void;
    addExp: (exp: number, vit: number) => void;
    addGoldFame: (gold: number, fame: number) => void;
  };
  storyFlags: { set: (id: string) => void };
  vit: number;
  luk: number;
  respawnRegionId: RegionId;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
  setHuntingActive: (next: boolean) => void;
  replaceLocation: (tab: TabKey, subView: string | null) => void;
  setMapProgress: (updater: (prev: MapProgress) => MapProgress) => void;
  /** 길드 의뢰 진행도 보고 — 길드 미가입/미매칭이면 서버가 silent ignore. */
  reportGuildKill?: (enemyName: string) => void;
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
    deps.reportGuildKill?.(payload.enemyName);
    deps.characterState.setHp(payload.finalPlayerHp);
    deps.characterState.addExp(payload.rewards.exp, deps.vit);
    // 보스 처치 시 storyFlag 발급 (data-driven, monster.onDefeatFlag).
    // useStoryFlags.set 은 idempotent 라 두 번째 처치는 무시 — 안전하게 매 처치마다 호출.
    const monster = MONSTERS[payload.enemyName];
    if (monster?.onDefeatFlag) {
      deps.storyFlags.set(monster.onDefeatFlag);
    }
    // 드롭 판정 — 몬스터의 drops 정의대로 확률 굴림.
    // kind 별로 인벤/골드/장비에 분배.
    if (monster?.drops) {
      // luk 1pt 당 드랍률 ×1.01 (multiplicative). 1.0 으로 capping 해 100% 초과 방지.
      const luckMultiplier = 1 + deps.luk * 0.01;
      for (const drop of monster.drops) {
        const adjustedChance = Math.min(1, drop.chance * luckMultiplier);
        if (Math.random() >= adjustedChance) continue;
        if (drop.kind === "material") {
          const amount = drop.amount ?? 1;
          deps.inventory.addMaterial(drop.materialId, amount);
          deps.addNotification(
            "info",
            `${MATERIALS[drop.materialId].name}${
              amount > 1 ? ` ×${amount}` : ""
            }을(를) 손에 넣었다.`,
          );
        } else if (drop.kind === "gold") {
          deps.characterState.addGoldFame(drop.amount, 0);
          deps.addNotification("info", `골드 +${drop.amount}`);
        } else if (drop.kind === "equip") {
          deps.inventory.addEquipment(drop.itemId);
          const equipDef = ITEMS[drop.itemId];
          deps.addNotification(
            "info",
            `${equipDef.name}을(를) 손에 넣었다!`,
            { highlight: { name: equipDef.name, className: rarityTextClass(equipDef) } },
          );
        } else if (drop.kind === "recipe") {
          if (deps.crafting.knows(drop.recipeId)) continue;
          deps.crafting.learnRecipe(drop.recipeId);
          const recipe = getRecipeById(drop.recipeId);
          deps.addNotification(
            "info",
            `${recipe?.name ?? drop.recipeId}을(를) 손에 넣었다!`,
          );
        } else if (drop.kind === "recipe_one_of") {
          // 풀에서 1개 학습 시도. 미보유 항목이 있으면 그중에서만 균등 추첨 — 사용자가
          // 이미 아는 항목으로 뽑혀 빈손이 되는 사고를 방지 (보스가 "항상 1종 드랍" 약속을
          // 지키는 모양새). 풀 전체를 이미 알고 있으면 그 사실을 명시 토스트로 안내.
          if (drop.recipeIds.length === 0) continue;
          const unknown = drop.recipeIds.filter(
            (id) => !deps.crafting.knows(id),
          );
          if (unknown.length === 0) {
            deps.addNotification(
              "info",
              "제작서 보상 — 이미 모든 종류를 알고 있다.",
            );
            continue;
          }
          const pick = unknown[Math.floor(Math.random() * unknown.length)];
          deps.crafting.learnRecipe(pick);
          const recipe = getRecipeById(pick);
          deps.addNotification(
            "info",
            `${recipe?.name ?? pick}을(를) 손에 넣었다!`,
          );
        }
      }
    }
    const reward =
      payload.rewards.exp > 0
        ? `EXP +${payload.rewards.exp}${
            payload.rewards.expBonusApplied ? " (신참 ×2)" : ""
          }`
        : "보상 없음";
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

  // 패배 — HP 0 + 복귀 마을 강제 이동 + 마을 탭 치료소 sub 로 점프 + 자동 사냥 해제.
  // replace 로 history 에 남기지 않음 (사망 직후로 back 되돌아갈 일 없음).
  deps.adventureLog.incrementBattleLosses();
  deps.characterState.setHp(0);
  deps.setHuntingActive(false);
  deps.replaceLocation("town", "healing");
  const respawnId = deps.respawnRegionId;
  deps.setMapProgress((prev) => ({
    ...prev,
    currentRegionId: respawnId,
    visitedRegionIds: prev.visitedRegionIds.includes(respawnId)
      ? prev.visitedRegionIds
      : [...prev.visitedRegionIds, respawnId],
  }));
  const respawnName =
    WORLD_MAP.regions.find((r) => r.id === respawnId)?.name ?? "마을";
  deps.addNotification(
    "battle_lose",
    `${payload.enemyName}에게 쓰러졌다... ${respawnName} 치유소에서 회복이 필요하다.`,
    { battleLog: payload.log },
  );
}
