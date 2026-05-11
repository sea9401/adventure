-- 길드 의뢰 3개 동시 진행 체제 전환.
-- 주간 발행 시 즉시 active 상태로 시작하므로 active 1개 제한 인덱스를 제거.
DROP INDEX IF EXISTS "guild_quest_active_unique_idx";
