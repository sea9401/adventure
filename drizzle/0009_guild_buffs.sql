-- 길드 버프 슬롯 — JSONB 배열로 보관. 슬롯 수 한도는 길드 등급에서 결정(서버 enforce).
-- 형식: [{ "buffId": "exp_boost", "tier": 3, "installedAt": "2026-05-11T..." }, ...]
ALTER TABLE "guilds" ADD COLUMN "buffs" jsonb DEFAULT '[]'::jsonb NOT NULL;
