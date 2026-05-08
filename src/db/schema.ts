import {
  pgTable,
  text,
  timestamp,
  jsonb,
  primaryKey,
  serial,
  index,
} from "drizzle-orm/pg-core";

// Clerk userId 와 게임 사용자 1:1 매핑.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export type User = typeof users.$inferSelect;
export type SavesKvRow = typeof savesKv.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
