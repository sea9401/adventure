// 어드민 페이지에서 게임 상태(여러 *.v1 키)를 일괄 read/write 하기 위한 어댑터.
// 게임 hook 들과 같은 키/포맷을 그대로 사용 — 단, hook 의 자동저장 사이클을 거치지
// 않고 직접 localStorage 에 쓰기 때문에 어드민에서 변경한 후 메인 게임 라우트는
// 수동 새로고침이 필요하다.

import {
  PROFILE_STORAGE_KEY,
  TRAINING_STORAGE_KEY,
  CHARACTER_STATE_KEY,
} from "@/lib/storage-keys";
import type { Profile } from "@/adventure/profile/useProfile";
import type { CharacterDynamicState } from "@/adventure/character/useCharacterState";
import type { InventoryState } from "@/adventure/inventory/useInventory";
import type { AutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import {
  CRAFTING_STORAGE_KEY,
  type CraftingState,
} from "@/adventure/crafting/storage";
import {
  QUEST_PROGRESS_KEY,
  type QuestProgressMap,
} from "@/adventure/quests/storage";
import {
  ADVENTURE_LOG_KEY,
  type AdventureLog,
} from "@/adventure/log/storage";
import {
  NOTIFICATIONS_STORAGE_KEY,
  type NotificationStorage,
} from "@/lib/notifications";
import {
  MAP_STORAGE_KEY,
  type MapProgress,
} from "@/lib/map-progress";
import {
  EDGE_UNLOCKS_KEY,
  type EdgeUnlocks,
} from "@/lib/edge-unlocks";
import type { StatKey } from "@/adventure/data/stats";

const INVENTORY_KEY = "inventory.v1";
const AUTO_POTION_KEY = "auto-potion-rules.v1";
const THEME_KEY = "theme";

export type TrainingPersisted = {
  endsAt?: number | null;
  points?: number;
  allocated?: Partial<Record<StatKey, number>>;
};

export const STORAGE_KEYS = {
  profile: PROFILE_STORAGE_KEY,
  character: CHARACTER_STATE_KEY,
  training: TRAINING_STORAGE_KEY,
  inventory: INVENTORY_KEY,
  autoPotion: AUTO_POTION_KEY,
  crafting: CRAFTING_STORAGE_KEY,
  quests: QUEST_PROGRESS_KEY,
  log: ADVENTURE_LOG_KEY,
  notifications: NOTIFICATIONS_STORAGE_KEY,
  map: MAP_STORAGE_KEY,
  edgeUnlocks: EDGE_UNLOCKS_KEY,
  theme: THEME_KEY,
} as const;

export type SaveBundleData = {
  profile?: Profile;
  character?: CharacterDynamicState;
  training?: TrainingPersisted;
  inventory?: InventoryState;
  autoPotion?: AutoPotionConfig;
  crafting?: CraftingState;
  quests?: QuestProgressMap;
  log?: AdventureLog;
  notifications?: NotificationStorage;
  map?: MapProgress;
  edgeUnlocks?: EdgeUnlocks;
  theme?: "light" | "dark";
};

export type SaveBundle = {
  schemaVersion: 1;
  exportedAt: number;
  data: SaveBundleData;
};

function readKey<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    if (key === THEME_KEY) {
      return raw as unknown as T;
    }
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function writeKey(key: string, value: unknown): void {
  try {
    if (key === THEME_KEY && typeof value === "string") {
      localStorage.setItem(key, value);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clearKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function loadBundle(): SaveBundle {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    data: {
      profile: readKey<Profile>(STORAGE_KEYS.profile),
      character: readKey<CharacterDynamicState>(STORAGE_KEYS.character),
      training: readKey<TrainingPersisted>(STORAGE_KEYS.training),
      inventory: readKey<InventoryState>(STORAGE_KEYS.inventory),
      autoPotion: readKey<AutoPotionConfig>(STORAGE_KEYS.autoPotion),
      crafting: readKey<CraftingState>(STORAGE_KEYS.crafting),
      quests: readKey<QuestProgressMap>(STORAGE_KEYS.quests),
      log: readKey<AdventureLog>(STORAGE_KEYS.log),
      notifications: readKey<NotificationStorage>(STORAGE_KEYS.notifications),
      map: readKey<MapProgress>(STORAGE_KEYS.map),
      edgeUnlocks: readKey<EdgeUnlocks>(STORAGE_KEYS.edgeUnlocks),
      theme: readKey<"light" | "dark">(STORAGE_KEYS.theme),
    },
  };
}

export function applyBundle(bundle: SaveBundle): void {
  const d = bundle.data ?? {};
  const map: { key: string; value: unknown }[] = [
    { key: STORAGE_KEYS.profile, value: d.profile },
    { key: STORAGE_KEYS.character, value: d.character },
    { key: STORAGE_KEYS.training, value: d.training },
    { key: STORAGE_KEYS.inventory, value: d.inventory },
    { key: STORAGE_KEYS.autoPotion, value: d.autoPotion },
    { key: STORAGE_KEYS.crafting, value: d.crafting },
    { key: STORAGE_KEYS.quests, value: d.quests },
    { key: STORAGE_KEYS.log, value: d.log },
    { key: STORAGE_KEYS.notifications, value: d.notifications },
    { key: STORAGE_KEYS.map, value: d.map },
    { key: STORAGE_KEYS.edgeUnlocks, value: d.edgeUnlocks },
    { key: STORAGE_KEYS.theme, value: d.theme },
  ];
  for (const { key, value } of map) {
    if (value === undefined) continue;
    writeKey(key, value);
  }
}

export function clearAll(): void {
  for (const key of Object.values(STORAGE_KEYS)) clearKey(key);
}

export function downloadBundle(bundle: SaveBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date(bundle.exportedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fname =
    `adventure-rpg-save-` +
    `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-` +
    `${pad(ts.getHours())}${pad(ts.getMinutes())}.json`;
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseBundle(text: string): SaveBundle | { error: string } {
  try {
    const obj = JSON.parse(text) as SaveBundle;
    if (!obj || typeof obj !== "object") return { error: "JSON 객체가 아님" };
    if (obj.schemaVersion !== 1) {
      return {
        error: `지원하지 않는 schemaVersion: ${String(obj.schemaVersion)}`,
      };
    }
    if (!obj.data || typeof obj.data !== "object") {
      return { error: "data 필드 누락" };
    }
    return obj;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "파싱 실패" };
  }
}

// 어드민에서 단일 키를 직접 갱신해야 하는 경우 사용. 메인 라우트는 새로고침 시 반영.
export function writeBundleKey<K extends keyof SaveBundleData>(
  key: K,
  value: SaveBundleData[K],
): void {
  const lsKey = STORAGE_KEYS[key as keyof typeof STORAGE_KEYS];
  if (value === undefined) {
    clearKey(lsKey);
    return;
  }
  writeKey(lsKey, value);
}
