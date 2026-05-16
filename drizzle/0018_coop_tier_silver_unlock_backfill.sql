-- 일회성 데이터 백필 — 협동 보스 처치 플래그를 "킬샷 친 1명" 에서
-- "silver+ 누적 기여자 전원" 으로 확장한 정책 변경(attack.ts) 의 과거 분 보정.
--
-- 영향: 처치된 협동 보스 세션의 contributor 중 누적 데미지 / max_hp ≥ 0.10 인 유저에게
-- 해당 region 의 onDefeatFlag 를 storyFlags.v2 에 합쳐 넣는다.
--
-- region→flag 매핑은 src/adventure/coop/data.ts 의 onDefeatFlag 와 동일.
-- 새 보스 추가 시 이 파일은 손대지 않고 신규 마이그레이션을 따로 만든다.

WITH region_flags(region_id, flag_id) AS (
  VALUES
    ('canyon',        'peak_giant_defeated'),
    ('starspire',     'starspire_keeper_defeated'),
    ('skyfolk_ruins', 'skyfolk_king_defeated'),
    ('apex_throne',   'endgame_apex_defeated'),
    ('dragon_nest',   'primordial_dragon_felled')
),
qualifying AS (
  SELECT DISTINCT c.user_id, rf.flag_id
  FROM coop_boss_contributors c
  JOIN coop_boss_sessions s ON s.id = c.session_id
  JOIN region_flags rf      ON rf.region_id = s.region_id
  WHERE s.defeated_at IS NOT NULL
    AND c.damage::numeric / s.max_hp >= 0.10
),
per_user AS (
  -- ON CONFLICT 가 같은 (user_id, key) 를 두 번 건드리면 에러나므로 유저당 1행으로 묶는다.
  SELECT user_id, jsonb_agg(flag_id) AS new_flags
  FROM qualifying
  GROUP BY user_id
)
INSERT INTO saves_kv (user_id, key, value, version, updated_at)
SELECT
  user_id,
  'storyFlags.v2',
  jsonb_build_object('flags', new_flags),
  1,
  NOW()
FROM per_user
ON CONFLICT (user_id, key) DO UPDATE SET
  -- 기존 flags 와 새 flags 의 합집합으로 머지 (중복 제거).
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
