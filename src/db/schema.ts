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
  boolean,
} from "drizzle-orm/pg-core";

// Auth.js(NextAuth) 와 게임 사용자 1:1 매핑.
// Auth.js DrizzleAdapter 가 name/email/emailVerified/image 를 관리.
// gameName: 인게임 닉네임. 중복 방지용 권위적(authoritative) 컬럼 — 최초 설정 시 등록.
// activeSessionId: 현재 활성 디바이스의 임의 토큰. 새 디바이스 로그인 시 새 토큰을
//   claim → 기존 디바이스의 다음 PATCH/GET 가 410 으로 거절돼 강제 로그아웃.
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    // Auth.js 표준 필드 — OAuth 공급자 프로필에서 자동 설정.
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    // 인게임 닉네임 — profile/setup API 로 사용자가 직접 설정.
    gameName: text("game_name"),
    activeSessionId: text("active_session_id"),
    // 자동 사냥(타이머형 30분 원정) 상태 — POST /api/hunt/dispatch 가 박고,
    // POST /api/hunt/collect 가 simMs=min(경과,30분) 만큼 sim·적용 후 NULL 로 종료.
    //   huntActive     = 위탁 진행 중 여부
    //   huntBaselineAt = 위탁 시작 시각 (서버 소유 — 클라 시계 skew·위변조 무관)
    //   huntRegion     = 위탁 사냥 지역
    //   huntBaselineHp = 위탁 시작 시점 HP (sim 시작 HP)
    // (컬럼명은 옛 "오프라인 사냥/서버 권위" 모델 잔재 — 이름 그대로 재활용.)
    huntActive: boolean("hunt_active").notNull().default(false),
    huntRegion: text("hunt_region"),
    huntBaselineHp: integer("hunt_baseline_hp"),
    huntBaselineAt: timestamp("hunt_baseline_at"),
    // lastClaimResult — 마지막 collect 결과 캐시. 응답 손실 후 재클릭 시 그대로 replay.
    // 새 dispatch 시작 시 NULL 로 리셋. lastClaimId 는 "collected" 마커로만 사용 (옛 잔재).
    lastClaimId: text("last_claim_id"),
    lastClaimResult: jsonb("last_claim_result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // 대소문자 무시 unique. NULL 은 자유롭게 허용 (기존 유저 호환).
    uniqueIndex("users_game_name_lower_idx").on(sql`lower(${t.gameName})`),
  ],
);

// Auth.js 연동 계정 — OAuth 공급자(Google/Kakao)와 users.id 매핑.
// allowDangerousEmailAccountLinking 으로 같은 이메일의 복수 공급자를 한 계정에 연동.
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

// Auth.js DB 세션 — JWT 전략 사용 시 미사용. 스키마만 유지 (adapter 요구).
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// 이메일 인증 토큰 — 매직 링크 사용 시. OAuth 전용 구성에선 미사용이나 adapter 요구.
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// 게임 진행 상태는 키별로 분리 저장. localStorage 패턴과 동일.
// 새 키 추가 시 마이그레이션 없이 행만 추가.
// version — 낙관적 동시성 제어. 매 write 마다 증가. PATCH 시 클라이언트가 expectedVersion 을
// 함께 보내고 서버가 일치할 때만 업데이트 (불일치 = 409, 다른 탭/기기에서 쓰기가 있었음).
export const savesKv = pgTable(
  "saves_kv",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    version: integer("version").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// 광장 게시판 글. 7일 후 cron 으로 일괄 삭제.
// name/className/title 은 전송 시점 스냅샷.
export const bulletinPosts = pgTable(
  "bulletin_posts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    className: text("class_name").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("bulletin_posts_created_at_idx").on(t.createdAt)],
);

// 글로벌 채팅 메시지. 3일 후 cron 으로 일괄 삭제.
// name/className/title 은 전송 시점 스냅샷 — 이후 사용자가 바뀌어도 과거 메시지는 그대로.
// title 은 미장착 시 NULL.
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    className: text("class_name").notNull(),
    title: text("title"),
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
  title: text("title"),
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

// 거래 결과 + 유저 간 쪽지 우편함. 사용자가 마을에서 "수령/확인" 누를 때까지 대기.
// kind: 'sale_proceeds' | 'purchase_item' | 'cancel_return' | 'user_message'
// payload 형식:
//   sale_proceeds:  { gold: number }
//   purchase_item:  { item_kind, item_id, quantity }
//   cancel_return:  { item_kind, item_id, quantity }
//   user_message:   { text: string }
// fromUserId/fromName 은 user_message 전용 — 시스템 발송분은 NULL.
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
    fromUserId: text("from_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    fromName: text("from_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    claimedAt: timestamp("claimed_at"),
  },
  (t) => [
    // 미수령 우편 — 가장 빈번한 쿼리.
    index("inbox_unclaimed_idx")
      .on(t.userId, t.createdAt)
      .where(sql`${t.claimedAt} IS NULL`),
    // 발송자 rate limit 조회용 partial index.
    index("inbox_from_user_idx")
      .on(t.fromUserId, t.createdAt)
      .where(sql`${t.fromUserId} IS NOT NULL`),
  ],
);

// 랭킹 — opt-in. 사용자가 명시적으로 등록한 경우에만 row 가 존재한다.
// 갱신은 수동 (RankingsView 의 '갱신' 버튼). DELETE 로 빠질 수 있음.
// name 은 등록/갱신 시점 스냅샷 — 이후 닉네임 변경되면 다음 갱신에서 반영.
export const rankings = pgTable(
  "rankings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    fame: integer("fame").notNull(),
    battleCount: integer("battle_count").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("rankings_level_idx").on(t.level),
    index("rankings_fame_idx").on(t.fame),
    index("rankings_battle_count_idx").on(t.battleCount),
  ],
);

// 길드 버프 슬롯 — JSONB 저장용 row 형 (id/tier 검증은 서버 핸들러에서 수행).
export type GuildBuffSlotRow = {
  buffId: string;
  tier: number;
  installedAt: string;
};

// 유저 자치 길드 — 정원 3명, 마스터 초대제, 자동 해체 정책.
// disbandedAt != NULL 이면 tombstone — 30일 후 cron 이 hard delete (이름 재사용 차단 기간).
// 활성 + tombstone 모두 unique 이므로 자연스레 30일 cooldown 이 됨.
export const guilds = pgTable(
  "guilds",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    masterId: text("master_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    disbandedAt: timestamp("disbanded_at"),
    // 누적 명성 — 영구, 등급(G~S) 결정. 길드 의뢰 보상 + 멤버 개인 명성 적립분.
    fameTotal: integer("fame_total").notNull().default(0),
    // 사용 가능 명성 — 누적과 동일하게 시작, 길드 버프 업그레이드에 소비.
    fameAvailable: integer("fame_available").notNull().default(0),
    // 마스터가 자유롭게 적는 짧은 소개글. 최대 120자(앱단 검증). NULL = 미설정.
    description: text("description"),
    // 길드 버프 슬롯 — { buffId, tier, installedAt }[]. 슬롯 수 한도는 등급 산식.
    buffs: jsonb("buffs")
      .$type<GuildBuffSlotRow[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    uniqueIndex("guilds_name_lower_idx").on(sql`lower(${t.name})`),
  ],
);

// 길드 소속. 1인 1길드 — userId 유니크 인덱스로 enforce.
// role: 'master' | 'member'.
export const guildMembers = pgTable(
  "guild_members",
  {
    guildId: integer("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guildId, t.userId] }),
    uniqueIndex("guild_members_user_unique_idx").on(t.userId),
  ],
);

// 길드 초대장. 7일 유효, 만료 시 cron 이 status='expired' 처리.
// status: 'pending' | 'accepted' | 'declined' | 'expired'.
// (guild, target) 쌍의 pending 중복은 partial unique 로 막음.
export const guildInvites = pgTable(
  "guild_invites",
  {
    id: serial("id").primaryKey(),
    guildId: integer("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    status: text("status").notNull().default("pending"),
  },
  (t) => [
    uniqueIndex("guild_invites_pending_unique_idx")
      .on(t.guildId, t.toUserId)
      .where(sql`${t.status} = 'pending'`),
    index("guild_invites_recipient_idx")
      .on(t.toUserId, t.createdAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

// 길드 탈퇴/추방 후 7일 쿨다운 — 다른 길드 가입 차단.
export const guildLeaveCooldown = pgTable("guild_leave_cooldown", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  cooldownUntil: timestamp("cooldown_until").notNull(),
});

// 길드 주간 의뢰 인스턴스. 매주 월 00:00 KST cron 으로 길드별 후보 3건 생성,
// 마스터가 1건 수락 → 활성. 일 23:59 KST 마감 cron 으로 미완료/미수락 → expired.
// status: 'proposed' | 'active' | 'completed' | 'dismissed' | 'expired'.
// 3개 동시 활성 체제 — 주간 발행 시 즉시 active, partial unique 없음.
export const guildQuestInstances = pgTable(
  "guild_quest_instances",
  {
    id: serial("id").primaryKey(),
    guildId: integer("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    weekStart: timestamp("week_start").notNull(),
    questDefId: text("quest_def_id").notNull(),
    grade: text("grade").notNull(), // 발행 시점 등급 스냅샷 G/F/E/D/C/B/A/S
    status: text("status").notNull(),
    progress: integer("progress").notNull().default(0),
    target: integer("target").notNull(),
    activatedAt: timestamp("activated_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("guild_quest_guild_week_idx").on(t.guildId, t.weekStart),
  ],
);

// 협동 보스 세션 — region 별 활성 인스턴스 1개 (uniqueIndex 로 enforce).
// hp 가 0 이 되거나 expiresAt 이 지나면 비활성. nextSpawnAt 후 cron 이 새 세션 생성.
export const coopBossSessions = pgTable(
  "coop_boss_sessions",
  {
    id: text("id").primaryKey(),
    regionId: text("region_id").notNull(),
    bossName: text("boss_name").notNull(),
    hp: integer("hp").notNull(),
    maxHp: integer("max_hp").notNull(),
    spawnedAt: timestamp("spawned_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    defeatedAt: timestamp("defeated_at"),
    nextSpawnAt: timestamp("next_spawn_at"),
  },
  (t) => [
    // region 당 활성 세션은 1개만 (defeatedAt IS NULL && expiresAt > now 가 활성).
    // 부분 unique 인덱스로 활성 세션만 제약.
    uniqueIndex("coop_boss_active_region_idx")
      .on(t.regionId)
      .where(sql`${t.defeatedAt} IS NULL`),
    index("coop_boss_next_spawn_idx").on(t.nextSpawnAt),
  ],
);

// 유저별 누적 데미지 + claim 상태.
export const coopBossContributors = pgTable(
  "coop_boss_contributors",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => coopBossSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    damage: integer("damage").notNull().default(0),
    attackCount: integer("attack_count").notNull().default(0),
    lastAttackAt: timestamp("last_attack_at"),
    claimedAt: timestamp("claimed_at"),
    claimedTier: text("claimed_tier"),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.userId] }),
    index("coop_boss_contributors_user_idx").on(t.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SavesKvRow = typeof savesKv.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type BulletinPostRow = typeof bulletinPosts.$inferSelect;
export type PresenceRow = typeof presence.$inferSelect;
export type MarketplaceListingRow = typeof marketplaceListings.$inferSelect;
export type MarketplaceInboxRow = typeof marketplaceInbox.$inferSelect;
export type RankingRow = typeof rankings.$inferSelect;
export type GuildRow = typeof guilds.$inferSelect;
export type GuildMemberRow = typeof guildMembers.$inferSelect;
export type GuildInviteRow = typeof guildInvites.$inferSelect;
export type GuildLeaveCooldownRow = typeof guildLeaveCooldown.$inferSelect;
export type GuildQuestInstanceRow = typeof guildQuestInstances.$inferSelect;
// 공격마다 1줄씩 기록되는 협동 보스 전투 로그.
// 모든 참여자의 공격을 시간순으로 모아 보스 카드 밑에 노출 — "다른 사람들 공격도 같이 본다".
// session 삭제 시 cascade. session 당 최근 N개만 의미가 있어 GET 에서 LIMIT.
// log: BattleLogEntry[] 그대로 저장 — 카드에서 펼치면 실제 전투 흐름 (강공격, 크리, 회피 등).
export const coopBossAttackLog = pgTable(
  "coop_boss_attack_log",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => coopBossSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    damageDealt: integer("damage_dealt").notNull(),
    damageTaken: integer("damage_taken").notNull(),
    diedEarly: boolean("died_early").notNull().default(false),
    log: jsonb("log").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("coop_boss_attack_log_session_idx").on(t.sessionId, t.createdAt),
  ],
);

export type CoopBossSessionRow = typeof coopBossSessions.$inferSelect;
export type CoopBossContributorRow = typeof coopBossContributors.$inferSelect;
export type CoopBossAttackLogRow = typeof coopBossAttackLog.$inferSelect;
