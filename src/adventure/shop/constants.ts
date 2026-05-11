// 상점 해금 관련 상수 — 클라(useShopUnlocks)와 서버(lib/server/shop) 양쪽이 import.
// useShopUnlocks 는 "use client" 라 서버에서 직접 import 하면 React 훅 모듈이 딸려 들어와
// 깔끔하지 않아 상수만 따로 뺀다.

// 한 재료를 상점에 누적 이만큼 팔면 같은 재료를 다시 상점에서 구매할 수 있게 풀린다.
export const SHOP_UNLOCK_THRESHOLD = 100;
export const SHOP_UNLOCK_STORAGE_KEY = "shop.unlocks.v1";
