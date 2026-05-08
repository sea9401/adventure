import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  primaryKey,
  serial,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Clerk userId 와 게임 사용자 1:1 매핑.
// name: 닉네임. 중복 방지용 권위적(authoritative) 컬럼 — 최초 설정 시 등록.
// 기존 유저는 NULL 인 상태로 시작하고, 새로 시작하는 유저만 unique 제약 적용.
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    name: text("name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // 대소문자 무시 unique. NULL 은 자유롭게 허용 (기존 유저 호환).
    uniqueIndex("users_name_lower_idx").on(sql`lower(${t.name})`),
  ],
);

// 게임 진행 상태는 키별로 분리 저장. localStorage 패턴과 동일.
// 새 키 추가 시 마이그레이션 없이 행만 추가.
export const savesKv = pgTable(
  "saves_kv",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// 글로벌 채팅 메시지. 3일 후 cron 으로 일괄 삭제.
// name/className 은 전송 시점 스냅샷 — 이후 사용자가 바뀌어도 과거 메시지는 그대로.
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    className: text("class_name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("messages_created_at_idx").on(t.createdAt)],
);

// 현재 접속 중인 유저 — 클라이언트가 주기적으로 하트비트(POST /api/presence)
// 보내 last_seen_at 갱신. "최근 X 초 이내 본 유저"가 온라인으로 간주된다.
// 행은 누적되지만 GET 시 시간 필터로 제외 — 별도 cleanup 불필요.
export const presence = pgTable("presence", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  className: text("class_name").notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

// 거래소 listing — 활성/판매됨/취소됨 모두 보관 (분석/감사용).
// item_kind: 'equip' | 'material' — 인벤토리 카테고리 매핑.
// item_name/seller_name 은 등록 시점 스냅샷 (이후 닉네임 변경되어도 표시 안정).
// price 는 정수 골드 (최대 999,999,999 < 2^31 이라 integer 충분).
export const marketplaceListings = pgTable(
  "marketplace_listings",
  {
    id: serial("id").primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerName: text("seller_name").notNull(),
    itemKind: text("item_kind").notNull(), // 'equip' | 'material'
    itemId: text("item_id").notNull(),
    itemName: text("item_name").notNull(),
    quantity: integer("quantity").notNull(),
    price: integer("price").notNull(),
    status: text("status").notNull().default("active"), // 'active'|'sold'|'cancelled'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    buyerId: text("buyer_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    // 활성 listing 의 아이템 종류·가격 검색용 partial index.
    index("listings_active_idx")
      .on(t.itemKind, t.itemId, t.price)
      .where(sql`${t.status} = 'active'`),
    // 내 등록 목록 / 슬롯 카운트.
    index("listings_seller_idx").on(t.sellerId, t.status, t.createdAt),
  ],
);

// 거래 결과 우편함. 사용자가 마을에서 "수령" 누를 때까지 대기.
// kind: 'sale_proceeds' | 'purchase_item' | 'cancel_return'
// payload 형식:
//   sale_proceeds:  { gold: number }
//   purchase_item:  { item_kind, item_id, quantity }
//   cancel_return:  { item_kind, item_id, quantity }
export const marketplaceInbox = pgTable(
  "marketplace_inbox",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    message: text("message"),
    listingId: integer("listing_id").references(() => marketplaceListings.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    claimedAt: timestamp("claimed_at"),
  },
  (t) => [
    // 미수령 우편 — 가장 빈번한 쿼리.
    index("inbox_unclaimed_idx")
      .on(t.userId, t.createdAt)
      .where(sql`${t.claimedAt} IS NULL`),
  ],
);

export type User = typeof users.$inferSelect;
export type SavesKvRow = typeof savesKv.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type PresenceRow = typeof presence.$inferSelect;
export type MarketplaceListingRow = typeof marketplaceListings.$inferSelect;
export type MarketplaceInboxRow = typeof marketplaceInbox.$inferSelect;
