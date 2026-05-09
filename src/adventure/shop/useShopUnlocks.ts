"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import type { MaterialId } from "@/adventure/data/materials";

// 상점에 누적 판매한 재료 수량을 추적. 임계치 이상이면 같은 재료를 상점에서 다시
// 구매할 수 있게 풀린다 (MaterialId 화이트리스트는 ShopView 가 inShop 와 함께 평가).
export const SHOP_UNLOCK_THRESHOLD = 100;
export const SHOP_UNLOCK_STORAGE_KEY = "shop.unlocks.v1";

export type ShopUnlocksState = {
  // 누적 판매량. 임계치 도달 후에도 계속 누적됨.
  sold: Partial<Record<MaterialId, number>>;
};

const empty = (): ShopUnlocksState => ({ sold: {} });

function read(raw: unknown): ShopUnlocksState {
  if (!raw || typeof raw !== "object") return empty();
  const p = raw as Partial<ShopUnlocksState>;
  return { sold: p.sold && typeof p.sold === "object" ? p.sold : {} };
}

export function useShopUnlocks() {
  const initial = useSavedValue(SHOP_UNLOCK_STORAGE_KEY);
  const [state, setState] = useState<ShopUnlocksState>(() => read(initial));
  useRemotePatch(SHOP_UNLOCK_STORAGE_KEY, state);

  // 판매할 때마다 호출. 임계치를 새로 넘긴 경우 true 반환 — 호출부에서 알림 발화에 사용.
  const recordSale = useCallback((id: MaterialId, qty: number): boolean => {
    if (qty <= 0) return false;
    let crossed = false;
    setState((prev) => {
      const before = prev.sold[id] ?? 0;
      const after = before + qty;
      if (before < SHOP_UNLOCK_THRESHOLD && after >= SHOP_UNLOCK_THRESHOLD) {
        crossed = true;
      }
      return { sold: { ...prev.sold, [id]: after } };
    });
    return crossed;
  }, []);

  const soldCount = useCallback(
    (id: MaterialId) => state.sold[id] ?? 0,
    [state.sold],
  );
  const isUnlocked = useCallback(
    (id: MaterialId) => (state.sold[id] ?? 0) >= SHOP_UNLOCK_THRESHOLD,
    [state.sold],
  );

  return { state, recordSale, soldCount, isUnlocked };
}
