"use client";

import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { BattleEndPayload, BattleView } from "@/adventure/BattleView";
import type { Character } from "@/adventure/character/types";
import type { useAdventureLog } from "@/adventure/log/useAdventureLog";
import type { useAutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import type { useCharacterState } from "@/adventure/character/useCharacterState";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useTrialUnlocks } from "@/adventure/edges/useTrialUnlocks";
import type { useInboxCount } from "@/adventure/marketplace/useInboxCount";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useNotifications } from "@/adventure/notifications/useNotifications";
import type { useProfile } from "@/adventure/profile/useProfile";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useShopUnlocks } from "@/adventure/shop/useShopUnlocks";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { useTraining } from "@/adventure/training/useTraining";
import type { TrialEdge } from "@/adventure/TrialView";
import type { ItemId, EquipSlot } from "@/adventure/data/items";
import type { MaterialId } from "@/adventure/data/materials";
import type { PotionId } from "@/adventure/data/potions";
import type { Recipe } from "@/adventure/data/recipes";
import type { Region } from "@/adventure/data/world";
import type { MapProgress } from "@/lib/map-progress";
import type {
  NotificationKind,
  NotificationMeta,
} from "@/lib/notifications";
import type { RemoteSave } from "@/lib/storage/remote";
import type { TabKey } from "@/lib/useNavTabs";

type PlayerCombat = React.ComponentProps<typeof BattleView>["player"];
type PlayerStatus = React.ComponentProps<typeof BattleView>["playerStatus"];

// 게임 전역 컨텍스트 — page.tsx Home() 에서 한 번 빌드해 모든 Screen 에 주입.
// Screen 들은 useGame() 으로 필요한 부분만 골라서 사용 → props 폭발 해소.
export type GameCtx = {
  // — Hooks (반환 객체 통째 노출. 일부만 쓸 때도 destructure 해서 사용) —
  inventory: ReturnType<typeof useInventory>;
  characterStateHook: ReturnType<typeof useCharacterState>;
  training: ReturnType<typeof useTraining>;
  crafting: ReturnType<typeof useCrafting>;
  quests: ReturnType<typeof useQuests>;
  adventureLog: ReturnType<typeof useAdventureLog>;
  notifications: ReturnType<typeof useNotifications>;
  trialUnlocks: ReturnType<typeof useTrialUnlocks>;
  storyFlags: ReturnType<typeof useStoryFlags>;
  shopUnlocks: ReturnType<typeof useShopUnlocks>;
  autoPotion: ReturnType<typeof useAutoPotionConfig>;
  remote: RemoteSave;
  inbox: ReturnType<typeof useInboxCount>;
  profile: ReturnType<typeof useProfile>;

  // — 파생값 (캐릭터/월드/전투) —
  character: Character;
  currentRegion: Region;
  isTown: boolean;
  effectiveSkillNameList: string[];
  trainingDescription: string;
  playerCombat: PlayerCombat;
  playerStatus: PlayerStatus;

  // — 지도 / 모험 임시 상태 —
  mapProgress: MapProgress;
  setMapProgress: Dispatch<SetStateAction<MapProgress>>;
  pendingTownNpcId: string | null;
  setPendingTownNpcId: Dispatch<SetStateAction<string | null>>;
  trialEdge: TrialEdge | null;
  /** 영구 저장된 누적 승수. trialEdge 가 null 이면 0. */
  trialWinCount: number;
  startTrial: (edge: TrialEdge) => void;
  endTrial: () => void;
  recordTrialWin: (winCount: number) => void;
  huntingActive: boolean;
  setHuntingActive: (next: boolean) => void;

  // — 네비게이션 —
  tab: TabKey;
  subView: string | null;
  setSubView: (next: string | null) => void;
  back: () => void;

  // — 핸들러 —
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
  handlePurchasePotion: (id: PotionId, quantity: number) => void;
  handlePurchaseMaterial: (id: MaterialId, quantity: number) => void;
  handleSellPotion: (id: PotionId, quantity: number) => void;
  handleSellMaterial: (id: MaterialId, quantity: number) => void;
  handleSellEquipment: (id: ItemId, quantity: number) => void;
  handleEquipFromInventory: (id: ItemId) => void;
  handleUnequip: (slot: EquipSlot) => void;
  handleCraft: (recipe: Recipe) => void;
  handleBattleEnd: (payload: BattleEndPayload) => void;
  handleAcceptQuest: (id: string) => void;
  handleClaimQuest: (id: string) => void;
  completeQuest: (id: string) => boolean;
};

const Ctx = createContext<GameCtx | null>(null);

export function GameProvider({
  value,
  children,
}: {
  value: GameCtx;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameCtx {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useGame must be used inside <GameProvider>");
  }
  return v;
}
