import type { BattleEndPayload } from "@/adventure/BattleView";
import type { PotionId } from "@/adventure/data/potions";
import type { MaterialId } from "@/adventure/data/materials";
import type { ItemId } from "@/adventure/data/items";
import { MONSTERS } from "@/adventure/data/monsters";
import { MATERIALS } from "@/adventure/data/materials";
import { ITEMS, isLuckyFind, rarityTextClass } from "@/adventure/data/items";
import {
  dropQualityPrefix,
  dropQualityTextClass,
  rollDropQuality,
  type DropQuality,
} from "@/adventure/data/dropQuality";
import { WORLD_MAP, type RegionId } from "@/adventure/data/world";
import { getQuestById } from "@/adventure/data/quests";
import { getRecipeById } from "@/adventure/data/recipes";
import { SKILL_BOOKS, type SkillBookId } from "@/adventure/data/skillBooks";
import { reportUniqueDrop } from "@/lib/clientFeed";
import {
  resolveBuffMultiplier,
  type GuildBuffSlot,
} from "@/adventure/data/guildBuffs";
import type { RuneBonusMap } from "@/adventure/character/runeBonus";
import { XP_RATE_MULT, getNewbieDropMultiplier } from "@/lib/leveling";
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
    /** 드랍 고품질(정교한/빼어난) 장비 1개 추가 — q 0(기본)은 addEquipment 로 간다. */
    addDroppedEquipment: (id: ItemId, q: DropQuality) => void;
    /** 스킬북 1권 추가 — AP 스킬 학습용 아이템. */
    addSkillBook: (id: SkillBookId, n?: number) => void;
  };
  adventureLog: {
    addKill: (name: string) => void;
    markTitleObtained: (titleId: string) => void;
    incrementBattleLosses: () => void;
  };
  quests: {
    recordKill: (
      name: string,
      ctx?: { hpFraction?: number; potionsUsed?: number },
    ) => string[];
  };
  crafting: {
    knows: (id: string) => boolean;
    learnRecipe: (id: string) => void;
  };
  characterState: {
    setHp: (n: number) => void;
    addExp: (exp: number, vit: number) => void;
    addGoldFame: (gold: number, fame: number) => void;
  };
  storyFlags: { set: (id: string) => void; has: (id: string) => boolean };
  /** 누적 보스 처치 수 (이번 처치 전 기준) — 보스 50회 업적 보상 발급용. */
  bossKillsTotal: number;
  /** 누적 일반 처치 수 (이번 처치 전 기준) — 1000회 사냥 폭주 업적 발급용. */
  totalKillsTotal: number;
  vit: number;
  luk: number;
  /** 신참 드롭 ×2 판정용. Lv 30 미만이면 ×2. */
  playerLevel: number;
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
  /** 길드 버프 슬롯 — EXP/골드/명성/드랍 배율 곱셈에 사용. 비어있으면 모두 ×1. */
  guildBuffs?: GuildBuffSlot[];
  /** 장착 룬 합산 보너스 — EXP%/드롭% 가산에 사용. 비어있으면 ×1. */
  runeBonus?: RuneBonusMap;
};

// BattleView 의 onBattleEnd 콜백 본체. 의존성을 명시적으로 주입받는 형태로
// page.tsx 에서 분리 — 테스트 가능 + 거대한 컴포넌트 본체에서 빠져나옴.
export function onBattleEnd(
  payload: BattleEndPayload,
  deps: BattleEndDeps,
): void {
  // 전투 중 사용된 포션을 인벤토리에서 차감 (resolveBattle 은 가짜 잔량으로 시뮬했음).
  let potionTotal = 0;
  for (const [id, n] of Object.entries(payload.potionsConsumed)) {
    if (n) {
      deps.inventory.consume(id as PotionId, n);
      potionTotal += n;
    }
  }
  // '포션 폭격기' — 승패 무관, 한 전투에서 5병 이상.
  if (potionTotal >= 5) deps.adventureLog.markTitleObtained("potion_overload");

  if (payload.outcome === "win") {
    deps.adventureLog.addKill(payload.enemyName);
    deps.adventureLog.markTitleObtained("first_blood");
    // '구사일생' — 체력 1 남긴 채 승리.
    if (payload.finalPlayerHp === 1) {
      deps.adventureLog.markTitleObtained("close_call");
    }
    // kill_within_hp / no_potion_boss 의뢰 판정용 ctx. autohunt 경로는 ctx 없이 호출 →
    // 조건부 kind 는 자동으로 진행 안 됨 (의도 — 라이브 도전 의뢰).
    const hpFraction =
      payload.playerMaxHp > 0 ? payload.finalPlayerHp / payload.playerMaxHp : 0;
    const readyQuestIds = deps.quests.recordKill(payload.enemyName, {
      hpFraction,
      potionsUsed: potionTotal,
    });
    deps.reportGuildKill?.(payload.enemyName);
    // 재생의 룬 — 승리 직후 maxHp × regen_pct/100 회복. 자동 사냥 패배 휴식 시스템은 영향 X (승리만).
    const runeRegenPct = deps.runeBonus?.regen_pct ?? 0;
    const runeRegenHeal =
      runeRegenPct > 0 && payload.playerMaxHp > 0
        ? Math.floor((payload.playerMaxHp * runeRegenPct) / 100)
        : 0;
    const hpAfterRegen =
      runeRegenHeal > 0
        ? Math.min(
            payload.playerMaxHp,
            payload.finalPlayerHp + runeRegenHeal,
          )
        : payload.finalPlayerHp;
    deps.characterState.setHp(hpAfterRegen);
    if (runeRegenHeal > 0 && hpAfterRegen > payload.finalPlayerHp) {
      deps.addNotification(
        "info",
        `재생의 룬 — HP +${hpAfterRegen - payload.finalPlayerHp}`,
      );
    }
    // 길드 버프 — 비어 있으면 모든 곱셈 ×1.0 (no-op).
    // 룬 EXP/드롭 % 도 길드 버프와 같은 자리에서 곱셈으로 합류.
    // 신참 드롭 ×2 도 같은 자리에서 합류 (Lv 30 미만일 때).
    const buffs = deps.guildBuffs ?? [];
    const runeExpMult = 1 + (deps.runeBonus?.exp_pct ?? 0) / 100;
    const runeDropMult = 1 + (deps.runeBonus?.drop_pct ?? 0) / 100;
    const newbieDropMult = getNewbieDropMultiplier(deps.playerLevel);
    const expMult = resolveBuffMultiplier(buffs, "exp_mult") * runeExpMult;
    const dropMult =
      resolveBuffMultiplier(buffs, "drop_mult") * runeDropMult * newbieDropMult;
    const boostedExp = Math.floor(payload.rewards.exp * expMult * XP_RATE_MULT);
    deps.characterState.addExp(boostedExp, deps.vit);
    // 보스 처치 시 storyFlag 발급 (data-driven, monster.onDefeatFlag).
    // useStoryFlags.set 은 idempotent 라 두 번째 처치는 무시 — 안전하게 매 처치마다 호출.
    const monster = MONSTERS[payload.enemyName];
    if (monster?.onDefeatFlag) {
      deps.storyFlags.set(monster.onDefeatFlag);
    }
    // 보스 누적 50회 업적 — 깊은 상처 스킬북 1회 지급. phaseTrigger 보유 = 보스.
    if (
      monster?.phaseTrigger &&
      deps.bossKillsTotal + 1 >= 50 &&
      !deps.storyFlags.has("deep_wound_book_granted")
    ) {
      deps.storyFlags.set("deep_wound_book_granted");
      deps.inventory.addSkillBook("book_deep_wound", 1);
      deps.addNotification(
        "milestone",
        "✨ 보스 50회 처치 — '스킬북 — 깊은 상처' 를 손에 넣었다!",
      );
    }
    // 누적 처치 1000회 업적 — 폭주 스킬북 1회 지급. monster 종류 무관.
    if (
      deps.totalKillsTotal + 1 >= 1000 &&
      !deps.storyFlags.has("frenzy_book_granted")
    ) {
      deps.storyFlags.set("frenzy_book_granted");
      deps.inventory.addSkillBook("book_frenzy", 1);
      deps.addNotification(
        "milestone",
        "✨ 누적 1000회 처치 — '스킬북 — 폭주' 를 손에 넣었다!",
      );
    }
    // 드롭 판정 — 몬스터의 drops 정의대로 확률 굴림.
    // kind 별로 인벤/골드/장비에 분배.
    if (monster?.drops) {
      // luk 1pt 당 드랍률 ×1.01 (multiplicative). 1.0 으로 capping 해 100% 초과 방지.
      // 길드 drop_boost 가 LUK 위에 또 곱해진다 (활성화 시 +0.5%~+2.5%).
      const luckMultiplier = 1 + deps.luk * 0.01;
      for (const drop of monster.drops) {
        const adjustedChance = Math.min(
          1,
          drop.chance * luckMultiplier * dropMult,
        );
        if (Math.random() >= adjustedChance) continue;
        if (drop.kind === "material") {
          const amount = drop.amount ?? 1;
          deps.inventory.addMaterial(drop.materialId, amount);
          deps.addNotification(
            "loot",
            `${MATERIALS[drop.materialId].name}${
              amount > 1 ? ` ×${amount}` : ""
            }을(를) 손에 넣었다.`,
          );
        } else if (drop.kind === "gold") {
          deps.characterState.addGoldFame(drop.amount, 0);
          deps.addNotification("loot", `골드 +${drop.amount}`);
        } else if (drop.kind === "equip") {
          // 드랍 품질 등급 롤 — 대부분 기본(접두어 없음), 가끔 정교한(+1u)/빼어난(+2u).
          // 보스·고티어는 monster.dropQualityBias 로 좋은 품질 가중치가 올라간다.
          const q = rollDropQuality(Math.random, monster.dropQualityBias ?? 1);
          if (q === 0) deps.inventory.addEquipment(drop.itemId);
          else deps.inventory.addDroppedEquipment(drop.itemId, q);
          const equipDef = ITEMS[drop.itemId];
          const name = dropQualityPrefix(q) + equipDef.name;
          // "유실된 명품"(unique)은 자주 보는 loot 토스트에 묻히지 않게 milestone 으로 띄우고
          // 메시지 앞에 강조 배너를 붙인다 — 잡몹한테서 떡상 장비가 나온 순간을 못 놓치게.
          const lucky = isLuckyFind(equipDef);
          // 유실된 명품 — 전체 소식(서버 피드)에도 한 줄 보고 (fire-and-forget).
          if (lucky) reportUniqueDrop(drop.itemId);
          deps.addNotification(
            lucky ? "milestone" : "loot",
            `${lucky ? "✨ 굉장한 발견! " : ""}${name}을(를) 손에 넣었다!`,
            {
              highlight: {
                name,
                className: q ? dropQualityTextClass(q) : rarityTextClass(equipDef),
              },
            },
          );
        } else if (drop.kind === "recipe") {
          if (deps.crafting.knows(drop.recipeId)) continue;
          deps.crafting.learnRecipe(drop.recipeId);
          const recipe = getRecipeById(drop.recipeId);
          deps.addNotification(
            "loot",
            `${recipe?.name ?? drop.recipeId}을(를) 손에 넣었다!`,
          );
        } else if (drop.kind === "skill_book") {
          deps.inventory.addSkillBook(drop.bookId, 1);
          const book = SKILL_BOOKS[drop.bookId];
          deps.addNotification(
            "milestone",
            `✨ ${book.name}을(를) 손에 넣었다!`,
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
              "loot",
              "제작서 보상 — 이미 모든 종류를 알고 있다.",
            );
            continue;
          }
          const pick = unknown[Math.floor(Math.random() * unknown.length)];
          deps.crafting.learnRecipe(pick);
          const recipe = getRecipeById(pick);
          deps.addNotification(
            "loot",
            `${recipe?.name ?? pick}을(를) 손에 넣었다!`,
          );
        }
      }
    }
    const reward =
      payload.rewards.exp > 0
        ? `EXP +${boostedExp}${
            payload.rewards.expBonusApplied ? " (신참 ×2)" : ""
          }${expMult > 1 ? " (길드 ×" + expMult.toFixed(2) + ")" : ""}`
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
