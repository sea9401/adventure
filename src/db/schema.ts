import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  primaryKey,
  serial,
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

export type User = typeof users.$inferSelect;
export type SavesKvRow = typeof savesKv.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type PresenceRow = typeof presence.$inferSelect;
