-- 일회성 데이터 백필 — 협동 보스 라우트 버그로 storyFlags.v1 에 잘못 박힌 플래그를
-- 클라가 읽는 storyFlags.v2 로 합쳐 옮김. 합집합 (DISTINCT) 으로 기존 v2 와 머지.
INSERT INTO saves_kv (user_id, key, value, version, updated_at)
SELECT
  v1.user_id,
  'storyFlags.v2',
  jsonb_build_object('flags', COALESCE(v1.value -> 'flags', '[]'::jsonb)),
  1,
  NOW()
FROM saves_kv v1
WHERE v1.key = 'storyFlags.v1'
ON CONFLICT (user_id, key) DO UPDATE SET
  value = jsonb_build_object(
    'flags',
    COALESCE(
      (
        SELECT jsonb_agg(DISTINCT f)
        FROM (
          SELECT jsonb_array_elements_text(saves_kv.value -> 'flags') AS f
          UNION
          SELECT jsonb_array_elements_text(EXCLUDED.value -> 'flags') AS f
        ) AS combined
      ),
      '[]'::jsonb
    )
  ),
  version = saves_kv.version + 1,
  updated_at = NOW();
--> statement-breakpoint
-- 백필 후 v1 row 정리.
DELETE FROM saves_kv WHERE key = 'storyFlags.v1';
