"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BUILDINGS,
  GRID_H,
  GRID_W,
  HERO_REGEN_INTERVAL,
  HERO_REGEN_PER_TICK,
  UNITS,
  defaultFiefdomState,
  heroAvailable,
  heroMaxHp,
} from "./builderData";
import type {
  Building,
  BuildingType,
  FiefdomState,
  ResourceBag,
  UnitType,
} from "./types";

// 길드 영지 라이브 모드 — 서버 sync.
// useBuilderState(로컬 모드)와 거의 같은 빌드/훈련/틱 로직이지만, 영속화는 localStorage 가
// 아닌 /api/fiefdom/me PUT, 공격은 /api/fiefdom/attack POST 로 처리.
// 별자리 맵 노드는 /api/fiefdom/browse 로 받은 다른 길드 목록.

const TICK_MS = 250;
const SAVE_DEBOUNCE_MS = 1500;

export type BrowseTarget = {
  guildId: number;
  guildName: string;
  lodgeRank: number;
  armySize: number;
  heroLevel: number;
  shieldUntil: string | null;
};

export type LiveLoadState =
  | { kind: "loading" }
  | { kind: "no_guild" }
  | { kind: "unauthorized" }
  | { kind: "network_error"; message: string }
  | { kind: "ready"; guildId: number; guildName: string };

export type LiveApi = {
  load: LiveLoadState;
  state: FiefdomState;
  shieldUntil: Date | null;

  // Build/train ops (BuilderApi compatible 부분).
  selectedBuild: BuildingType | null;
  setSelectedBuild: (t: BuildingType | null) => void;
  canAffordBuild: (t: BuildingType) => boolean;
  canPlaceAt: (t: BuildingType, x: number, y: number) => boolean;
  placeBuilding: (t: BuildingType, x: number, y: number) => void;
  trainUnit: (t: UnitType) => void;
  canAffordUnit: (t: UnitType) => boolean;
  hasBarracks: boolean;
  renameHero: (name: string) => void;
  /** 로컬 모드 호환을 위한 stub — 라이브에서는 attackGuild 사용. */
  attackTerritory: (id: string) => void;
  /** 로컬 모드 호환을 위한 stub — 라이브에서는 disable. */
  reset: () => void;

  // Live-only.
  targets: BrowseTarget[];
  refreshTargets: () => Promise<void>;
  attackGuild: (defenderGuildId: number) => Promise<void>;

  lastLog: string[];
};

function canAfford(resources: ResourceBag, cost: Partial<ResourceBag>): boolean {
  for (const k of Object.keys(cost) as Array<keyof ResourceBag>) {
    if ((resources[k] ?? 0) < (cost[k] ?? 0)) return false;
  }
  return true;
}
function pay(resources: ResourceBag, cost: Partial<ResourceBag>): ResourceBag {
  const out = { ...resources };
  for (const k of Object.keys(cost) as Array<keyof ResourceBag>) {
    out[k] = (out[k] ?? 0) - (cost[k] ?? 0);
  }
  return out;
}
function buildingAt(buildings: Building[], x: number, y: number) {
  return buildings.find((b) => {
    const s = BUILDINGS[b.type].size;
    return x >= b.x && x < b.x + s && y >= b.y && y < b.y + s;
  });
}
function canPlace(buildings: Building[], type: BuildingType, x: number, y: number) {
  const s = BUILDINGS[type].size;
  if (x < 0 || y < 0 || x + s > GRID_W || y + s > GRID_H) return false;
  for (let dx = 0; dx < s; dx++) {
    for (let dy = 0; dy < s; dy++) {
      if (buildingAt(buildings, x + dx, y + dy)) return false;
    }
  }
  return true;
}

export function useFiefdomServer(): LiveApi {
  const [load, setLoad] = useState<LiveLoadState>({ kind: "loading" });
  const [state, setState] = useState<FiefdomState>(() => defaultFiefdomState());
  const [shieldUntil, setShieldUntil] = useState<Date | null>(null);
  const [selectedBuild, setSelectedBuild] = useState<BuildingType | null>(null);
  const [lastLog, setLastLog] = useState<string[]>([]);
  const [targets, setTargets] = useState<BrowseTarget[]>([]);

  // 서버에서 받아온 직후 첫 PUT 을 막기 위한 가드(불필요한 round-trip 절약).
  const hydrated = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  // ref 갱신은 useEffect 안에서 — render 중 ref 쓰기는 React 19 stricter rule 위반.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pushLog = useCallback((msg: string) => {
    setLastLog((prev) => {
      const time = new Date().toLocaleTimeString();
      return [`[${time}] ${msg}`, ...prev].slice(0, 30);
    });
  }, []);

  // 초기 GET.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/fiefdom/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          setLoad({ kind: "unauthorized" });
          return;
        }
        if (res.status === 403) {
          setLoad({ kind: "no_guild" });
          return;
        }
        if (!res.ok) {
          setLoad({ kind: "network_error", message: `HTTP ${res.status}` });
          return;
        }
        const body = (await res.json()) as {
          guildId: number;
          guildName: string;
          state: FiefdomState;
          shieldUntil: string | null;
        };
        setState(body.state);
        setShieldUntil(body.shieldUntil ? new Date(body.shieldUntil) : null);
        setLoad({ kind: "ready", guildId: body.guildId, guildName: body.guildName });
        hydrated.current = true;
      } catch (e) {
        if (cancelled) return;
        setLoad({ kind: "network_error", message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 수동/사후 refresh 용 (버튼·공격 후 호출).
  const refreshTargets = useCallback(async () => {
    try {
      const res = await fetch("/api/fiefdom/browse", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { targets: BrowseTarget[] };
      setTargets(body.targets);
    } catch {
      // browse 실패는 silent — 맵 노드 0개로 표시.
    }
  }, []);

  // 초기 browse 로드 — ready 직후 한 번. 클린업으로 cancellation 처리.
  useEffect(() => {
    if (load.kind !== "ready") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/fiefdom/browse", { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as { targets: BrowseTarget[] };
        setTargets(body.targets);
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load.kind]);

  // Tick — 로컬 모드와 동일한 자원/훈련/regen 처리. 서버 권위 tick 으로 옮기는 건 후속.
  useEffect(() => {
    if (load.kind !== "ready") return;
    const id = window.setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        let changed = false;
        const resources = { ...prev.resources };
        const buildings = prev.buildings.map((b) => {
          const def = BUILDINGS[b.type];
          if (!def.produces || !def.interval || !b.lastProduce) return b;
          let lastProduce = b.lastProduce;
          while (now - lastProduce >= def.interval) {
            for (const k of Object.keys(def.produces) as Array<keyof ResourceBag>) {
              resources[k] = (resources[k] ?? 0) + (def.produces[k] ?? 0);
              changed = true;
            }
            lastProduce += def.interval;
          }
          return lastProduce === b.lastProduce ? b : { ...b, lastProduce };
        });

        const units = { ...prev.units };
        const remainingQueue: typeof prev.trainQueue = [];
        for (const item of prev.trainQueue) {
          if (now >= item.finishAt) {
            units[item.type] = (units[item.type] ?? 0) + 1;
            changed = true;
            pushLog(`${UNITS[item.type].name} 훈련 완료`);
          } else {
            remainingQueue.push(item);
          }
        }

        let hero = prev.hero;
        if (hero.recoveringUntil > 0 && now >= hero.recoveringUntil) {
          hero = {
            ...hero,
            recoveringUntil: 0,
            currentHp: heroMaxHp(hero),
            lastRegen: now,
          };
          changed = true;
          pushLog(`✨ ${hero.name}이(가) 회복하여 돌아왔습니다!`);
        }
        if (heroAvailable(hero, now)) {
          const max = heroMaxHp(hero);
          if (hero.currentHp < max) {
            const elapsed = now - (hero.lastRegen || now);
            const ticks = Math.floor(elapsed / HERO_REGEN_INTERVAL);
            if (ticks > 0) {
              hero = {
                ...hero,
                currentHp: Math.min(max, hero.currentHp + ticks * HERO_REGEN_PER_TICK),
                lastRegen: (hero.lastRegen || now) + ticks * HERO_REGEN_INTERVAL,
              };
              changed = true;
            }
          } else if (hero.lastRegen !== now && hero.currentHp >= max) {
            hero = { ...hero, lastRegen: now };
          }
        }

        if (!changed && remainingQueue.length === prev.trainQueue.length) return prev;
        return { ...prev, resources, buildings, units, trainQueue: remainingQueue, hero };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [load.kind, pushLog]);

  // 디바운스 PUT — 1.5초 idle 마다 서버 동기화.
  useEffect(() => {
    if (load.kind !== "ready" || !hydrated.current) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch("/api/fiefdom/me", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: stateRef.current }),
      }).catch(() => {
        // 저장 실패는 다음 변화 때 재시도. silent.
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [state, load.kind]);

  const canAffordBuild = useCallback(
    (t: BuildingType) => canAfford(state.resources, BUILDINGS[t].cost),
    [state.resources],
  );
  const canPlaceAt = useCallback(
    (t: BuildingType, x: number, y: number) => canPlace(state.buildings, t, x, y),
    [state.buildings],
  );

  const placeBuilding = useCallback(
    (t: BuildingType, x: number, y: number) => {
      setState((prev) => {
        const def = BUILDINGS[t];
        if (def.max && prev.buildings.filter((b) => b.type === t).length >= def.max) {
          pushLog(`${def.name}은 더 이상 지을 수 없습니다.`);
          return prev;
        }
        if (!canPlace(prev.buildings, t, x, y)) {
          pushLog("이 위치에는 지을 수 없습니다.");
          return prev;
        }
        if (!canAfford(prev.resources, def.cost)) {
          pushLog("자원이 부족합니다.");
          return prev;
        }
        const b: Building = { type: t, x, y };
        if (def.produces) b.lastProduce = Date.now();
        pushLog(`${def.name} 건설 완료`);
        return {
          ...prev,
          resources: pay(prev.resources, def.cost),
          buildings: [...prev.buildings, b],
        };
      });
      setSelectedBuild(null);
    },
    [pushLog],
  );

  const canAffordUnit = useCallback(
    (t: UnitType) => canAfford(state.resources, UNITS[t].cost),
    [state.resources],
  );
  const hasBarracks = state.buildings.some((b) => b.type === "barracks");

  const trainUnit = useCallback(
    (t: UnitType) => {
      setState((prev) => {
        const def = UNITS[t];
        if (!prev.buildings.some((b) => b.type === "barracks")) {
          pushLog("병영을 먼저 지으세요.");
          return prev;
        }
        if (!canAfford(prev.resources, def.cost)) {
          pushLog("자원이 부족합니다.");
          return prev;
        }
        const now = Date.now();
        const lastFinish =
          prev.trainQueue.length > 0
            ? prev.trainQueue[prev.trainQueue.length - 1].finishAt
            : now;
        pushLog(`${def.name} 훈련 예약`);
        return {
          ...prev,
          resources: pay(prev.resources, def.cost),
          trainQueue: [...prev.trainQueue, { type: t, finishAt: lastFinish + def.trainTime }],
        };
      });
    },
    [pushLog],
  );

  const renameHero = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;
    setState((prev) => ({ ...prev, hero: { ...prev.hero, name: trimmed } }));
  }, []);

  const attackGuild = useCallback(
    async (defenderGuildId: number) => {
      try {
        const res = await fetch("/api/fiefdom/attack", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ defenderGuildId }),
        });
        const body = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          if (body.error === "defender_shielded") {
            pushLog(`🛡️ 상대 보호막 활성화 (${body.shieldUntil ?? "?"} 까지)`);
          } else {
            pushLog(`❌ 공격 실패: ${body.error ?? "unknown"}`);
          }
          // 공격 실패 후 browse 재로드 — shield 상태 갱신.
          refreshTargets();
          return;
        }
        const result = body as {
          won: boolean;
          loot: { gold: number; wood: number; food: number };
          myStateAfter: FiefdomState;
          defenderShieldUntil: string;
        };
        setState(result.myStateAfter);
        const lootText = result.won
          ? ` | 약탈 🪙${result.loot.gold} 🪵${result.loot.wood} 🌾${result.loot.food}`
          : "";
        pushLog(`${result.won ? "🎉 승리!" : "💀 패배..."}${lootText}`);
        refreshTargets();
      } catch (e) {
        pushLog(`❌ 네트워크 오류: ${(e as Error).message}`);
      }
    },
    [pushLog, refreshTargets],
  );

  const attackTerritory = useCallback((id: string) => {
    // 라이브 모드에서는 호출되면 안 되는 stub — BuilderApi 인터페이스 호환용.
    // 실제 라이브 공격은 attackGuild 가 담당.
    console.warn("[useFiefdomServer] attackTerritory stub invoked with id:", id);
  }, []);
  const reset = useCallback(() => {
    pushLog("라이브 모드에서는 영지 초기화가 불가합니다.");
  }, [pushLog]);

  return {
    load,
    state,
    shieldUntil,
    selectedBuild,
    setSelectedBuild,
    canAffordBuild,
    canPlaceAt,
    placeBuilding,
    trainUnit,
    canAffordUnit,
    hasBarracks,
    renameHero,
    attackTerritory,
    reset,
    targets,
    refreshTargets,
    attackGuild,
    lastLog,
  };
}
