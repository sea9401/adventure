// 전체 소식(서버 피드) 제약 — 클라/서버 공통.
//
// 채팅과 분리된 "전광판" — 서버 전체에 흘러가는 자랑거리(유실된 명품 획득, 걸작 제작 성공).
// 모험탭 하단 패널에서 최근 FEED_FETCH_LIMIT 개만 노출. append-only — insert 시 FEED_MAX_ROWS
// 초과분을 잘라낸다(cron 없음).

// GET /api/feed 가 돌려주는 최근 항목 수. 패널이 한 번에 보여주는 상한.
export const FEED_FETCH_LIMIT = 20;

// DB 에 유지하는 최대 행 수 — insert 마다 초과분 trim. 활동량 변동에 강하도록 기간이 아닌 행 수 기준.
export const FEED_MAX_ROWS = 500;

// 같은 유저+type 디바운스 — 이 시간 안에 동일 종류 항목이 이미 있으면 새 항목을 만들지 않는다.
// 연달아 터뜨려도 도배되지 않게.
export const FEED_DEBOUNCE_MS = 60_000;

// 클라이언트 패널 폴링 주기.
export const FEED_POLL_MS = 30_000;

// 피드 항목 종류. v2 에서 'milestone' 등 추가.
export const FEED_TYPES = ["unique_drop", "masterpiece"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

// type 별 payload. 아이템 이름은 클라에서 ITEMS 로 해석 — itemId 만 저장.
export type FeedPayload =
  | { itemId: string } // unique_drop
  | { itemId: string }; // masterpiece (항상 걸작 등급)

// 클라/서버가 주고받는 한 항목.
export type FeedEntry = {
  id: number;
  type: FeedType;
  actorName: string;
  payload: FeedPayload;
  createdAt: number; // epoch ms
};
