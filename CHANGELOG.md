# 변경 이력

이 프로젝트의 모든 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 1.1.0 기반,
시맨틱 버저닝은 출시 시점부터 적용 예정.

## [Unreleased]

운영 인프라·UX 폴리싱·출시 준비를 마친 출시 직전 상태.

### 추가됨 (Added)

- **알림 센터 (notification bell)** — 헤더 우상단 🔔 종 아이콘 + 미확인 빨간 점/숫자 배지 (99+ 클램프). 클릭 시 드롭다운 패널 (sm: 우측 320w / 모바일: 풀폭 70vh) — 자동 read 처리, "모두 지우기" 액션, 외부 클릭 닫힘. 데이터 모델: `types/state.ts`에 `NotificationType`/`Notification` 타입, `GameState.notifications?: Notification[]` 옵셔널 (마이그레이션 불필요). 보스 finalize에서 `droppedUniqueEquipment` 시 prepend (cap 50). 토스트는 즉시 인지용으로 병행 유지 — 영구 기록 + 휘발성 두 채널 운용.
- **얼음 방패 액티브 스킬** (구 냉기 갑주 패시브 폐기) — `frost_armor` 효과 변경: passive damage_reduction 10% → 5턴 쿨 `shield_absorb intMult 3.0`. 발동 시 INT × 3.0 만큼 쉴드 획득, 피격 시 HP 전에 흡수 (재시전 시 덮어씀, 스택 X). 신규 SkillEffect `shield_absorb`. 3개 resolver (`resolve-dispatch` / `resolve-boss-dispatch` / `simulate-coop`)에 통합 — 보스 스킬 flat_damage / DOT까지 모두 흡수. 로그: 발동 "🛡 쉴드 N" / 흡수 "🛡 −N" (단발) / "🛡 흡수 N" (다타).
- **원소술사 컨셉 재설계 — 원소 스택 + 콤보 시스템** (`docs/24`) — 4개 액티브를 즉발 데미지에서 자기 버프 스택 + 7가지 콤보 분기로 교체. cap 3 (종류 무관, FIFO push out), 콤보 cd 6턴, 발동 시 스택 소비 + 자기 버프 3턴 잔존. 부여 스킬은 즉발 데미지 0 ("큰 한 방을 준비하는 마법사" 정체성). 자기 버프: 불 INT +10/25/45% (3스택 마법 크리 +10%) / 얼음 DEF·MDEF +15/30/50% (3스택 받는 데미지 −10%) / 번개 SPD +5/12/20 (3스택 자동 마법 ×2). 콤보 7종: 지옥불 / 절대영도 / 뇌신강림 / 마그마 폭발 / 플라즈마 / 빙뢰 폭풍 / 원소 조화. 일반 탐험 + 필드 보스 + 협동 보스 3개 resolver 모두 통합. persist v2→v3 자동 마이그레이션 (구 4종 ID `flame_burst`/`ice_spike`/`lightning_chain`/`meteor_descent` → 신규 4종 매핑, skillExp 보존).
- **원소 스택 인디케이터 UI + 로그 색상화** — `DispatchLogEntry` / `BossCombatLogEntry`에 `elements?: ElementKind[]` + `elementLingerTurns?: number` 스냅샷 필드. LogStream 캐릭터 HP 옆에 3슬롯 인디케이터 (🔥 red / ❄️ cyan / ⚡ violet / ⚪ 빈 + ✨ 잔존 NT). 원소 부여 / 콤보 텍스트 토큰별 색상 강조. 비-원소술사는 자동 숨김.
- **폭렬권 / 파괴의 일격 재설계 — 소모 HP만큼 데미지 합산** — `extra_damage_with_stun`에 `addHpCostAsDamage?: boolean` 옵션 신설. 발동 시 `maxHp × selfHpCostPct` 만큼 평타에 flat 데미지 합산 (방어 무시 보너스). 폭렬권 4턴 ×3 + HP 10%, 파괴의 일격 6턴 ×6 + HP 15%. 광전사 정체성 강화 ("자기 피를 더 많이 흘릴수록 무거워지는 한 방").
- **장비 도감 자동 등록 — 획득 시 무료 등록** — 보스 유니크 드랍 / 제작 시점에 `codex.equipment`에 자동 추가, 인벤토리 차감 없음. `CODEX_EQUIPMENT_COST` 1 → 0. CodexPanel 등록 버튼 제거, 보유/등록 표시만 (✓ / —). persist v3→v4 자동 마이그레이션 — 기존 보유 장비를 일괄 등록해 잠재 코덱스 포인트 부여.
- **게시판 (Board) 시스템 — Stage 1~3** — KV 저장소 + `/api/board/*` 5개 API (목록/생성/삭제/신고/관리) + BoardPanel UI + 관리자 콘솔 (`/admin/board` 신고 큐 + 강제 삭제). 사용자 간 짧은 글 공유.
- **대련 닉네임 squat 차단 + Owner token + Redis Hash** — 등록 시 owner token 발급, 같은 닉네임 재등록 차단. Hash 자료구조로 풀 race condition 해결.
- **TabNavigation 드롭다운 React Portal 분리** — overflow-x-auto 컨테이너 안에서 잘려 안 보이던 풀다운을 Portal로 body 렌더. 모바일 가로 스크롤 + 드롭다운 동시 작동.
- **중간 티어 세트 장비 색상 구분** — 사막 / 설원 / 해적 / 유령선 세트 무기 하늘색 (`rarity-mid`). 일반·후반 세트와 시각 구분.
- **모바일 UI 폴리시 P1 / P2** (`docs/26`) —
  - P1: 풀스크린 모달, 전 숫자 tabular-nums(등폭), 자동 스크롤 사용자 의도 존중 (위로 스크롤 시 자동 정지)
  - P2: 탭 전환 시 스크롤 top, 단축키 모바일 숨김, themeColor 메타 보강
- **보물 드랍 — 분당 1회 독립 굴림** (`docs/22`) — `region.treasure.chance` 의미를 dispatch당 → 60초당으로 재정의. `TREASURE_ROLL_PERIOD_SEC=60` 신규 상수. `DispatchResult`에 `treasureRolls: number[]`/`treasureHits: number` 보존. `Treasure | null` 단일 → `formatTreasure(t, hits)`로 `×N` 배지 표시. 길이별 보상 격차 120×→1.33×로 완화 (1초당 보물 골드 1.00:0.88:0.75 곡선 일치). 검증: `scripts/treasure-rate-sim.ts` (RUNS=5000, 오차 ±2%).
- **탐험 조기 종료 — 진행분 비례 부분 보상** (`docs/18`) — `cancelDispatch`가 `elapsedSec/playbackSec` 비례로 자원·EXP·재료를 분배, 보물은 `treasureRolls.slice(0, floor(elapsedSec/60))`로 자연 비례. finalMult는 출발 시점 길이의 효율(1.0/0.88/0.75) 그대로 유지 → 취소가 효율 우회 경로 X. 보스 탐험·5초 미만 제외 (보상 0). `LogEntry.earlyExit="cancel"` 신규 필드, sky 색 + "N킬 · 조기 종료" 라벨. AI 리포트는 sync 동작 유지를 위해 cancel 경로에서 건너뜀 (로컬 템플릿 메시지). 검증: `scripts/cancel-partial-sim.ts` (progress=0.5 오차 0%, 7200@1800 cancel = 0.852× 정확 일치).
- **마법사 1차 패시브 `mana_orb`** — 기본 공격을 INT 기반 마법 데미지로 대체. 1차 마법사의 일반 공격 약점 보완 (구 fireball 액티브 → 패시브 변환).
- **캐릭터 시트 정체성 자원 환산값 표기** (`docs/20` §10) — STR/VIT/MATK가 ATK/DEF/INT/HP에 얼마나 환산되는지 직접 표시.
- **모바일 UI 폴리시 P0** (`docs/25·26`) — safe area inset 적용, 입력 시 자동 줌 차단, 탭 네비게이션 가로 스크롤 지원.
- **시뮬 스크립트 정비** — `scripts/`에 `treasure-rate-sim.ts`, `cancel-partial-sim.ts`, `identity-stat-sim.ts`, `identity-stat-applied-check.ts`, `mage-coefficient-review.ts` 추가. 모두 `npx tsx` 실행 형식.
- **운영/모니터링 시스템**
  - Sentry 에러 모니터링 (`@sentry/nextjs`) — 클라이언트/서버/edge 통합, PII 마스킹
  - 사용자 피드백 폼 — 우하단 💬 버튼 + 모달 + `/api/feedback` (rate-limit 3/분, IP 해시)
  - 관리자 콘솔 (`/admin`) — 피드백 조회·상태 변경, 메트릭스 대시보드
  - Vercel Analytics — 페이지뷰·Web Vitals 자동 수집 + 커스텀 이벤트 헬퍼
  - 게임 메트릭스 — DAU·신규·보스 처치 추적, `/api/stats/global` (1h 캐시), `/api/stats/timeseries` (90일)
  - 메트릭스 대시보드 — KPI 4 + 30일 라인 차트 3 + Top 보스 누적
- **출시 준비**
  - `app/error.tsx`, `app/not-found.tsx` 커스텀 에러 페이지 (Sentry 자동 캡처)
  - `app/robots.ts`, `app/sitemap.ts`
  - 메타데이터 (OG, Twitter, keywords, robots) 보강
  - `.env.example` 작성 (모든 환경 변수 + 운영 가이드 코멘트)
- **UX 폴리싱**
  - 장비 슬롯 비교 툴팁 — 인벤토리 hover 시 현재 장착 대비 스탯 차이(↑/↓)
  - 도감 진척바 — 메인 진척률 + 다음 포인트 미니 바
  - 키보드 단축키 — `1~7` 탭 / `?` 도움말 / `Esc` 모달 닫기
  - 첫 사용자 온보딩 — 3장 환영 모달 (`welcomeShown` 플래그)
  - 업적 카테고리별 완료/총개수 카운트 + 전체/완료/진행 중 필터
  - 모바일 반응형 (좌/우 분할 전투 로그 → 모바일 세로 스택)
- **장비 시스템**
  - 보스 유니크 드랍 11종 (각 보스 1% 확률, 제작 불가)
  - 장비 등급 색상 구분 (자홍 = 보스 제작 / 주황 = 드랍 전용)
  - 인벤토리 비교 툴팁
- **게임 시스템**
  - STR/VIT/MATK 주속성 — ATK/DEF/INT에 자동 환산
  - 명예의 전당 (Monument) — 보스 트로피 영구 스탯 (Lv 1~25, +5%/lv)
  - 기록의 서 (Codex) — 재료/장비 등록 + 포인트 분배 (CodexPanel)
  - 라이트/다크 테마 전환 (CSS 변수 기반)
- **컨텐츠**
  - 11개 필드 보스 (평야 ~ 심연 핵)
  - 3개 코옵 보스 (산군·그리폰·크라켄)
  - 대련 (Arena) — NPC + 등록 플레이어 풀
- **API**
  - 모든 API에 IP 기반 rate-limit (KV 우선, 메모리 fallback)
  - `/api/feedback`, `/api/stats/global`, `/api/stats/timeseries` 신규
- **문서**
  - `docs/` 16+ markdown — 캐릭터·전투·스킬·장비·컨텐츠·진행·기술·밸런스 참조·운영 설계·구현 계획·UX·출시 준비
  - `docs/16` 레벨 캡 150 (적용 완료), `docs/17` 2차 전직 퀘스트 (설계안), `docs/18` 조기 종료 부분 보상 (적용 완료), `docs/19` 1킬/턴 가이드, `docs/20` 정체성 자원 변환 계수 (적용 완료), `docs/22` 보물 분당 굴림 (적용 완료), `docs/23·24` 마법사·원소술사 개선 (설계안), `docs/25·26` 모바일 UI 폴리시 (P0 적용)

### 변경됨 (Changed)

- **마력구체 def_pierce 적용 제거** — 마법사 클래스 패시브 `def_pierce 50%`가 mana_orb 기본 공격(MDEF 차감)에 적용되던 동작을 제거. 마력 친화(+10%) + 원소 가속(+30%) 곱연산까지 누적되어 후반 데미지가 과해지는 문제 보정. 평야 등 저-MDEF 영향 0, 심연 핵(MDEF 80) −40 데미지로 후반 고-MDEF 영역만 너프. 스킬 기반 `defPiercePct`는 유지 (추후 마법 관통 스킬 대비). 부수: 클래스 패시브가 mana_orb 장착 시 휴면 상태 — 마법사 재설계 PR에서 별도 패시브로 교체 검토 권장. 툴팁도 "(적 MDEF 차감, def_pierce 적용)" → "(적 MDEF 차감)"로 정정.
- **전투 로그 — 비-데미지 스킬(버프) 발동 라인을 공격 라인 뒤로 이동** — 광기의 외침 같은 self-buff가 공격 슬롯 1개를 차지하면서도 발동 로그가 공격 헤더보다 먼저 표시되어 "왜 1회 공격만 떴지?" 혼란을 유발했다. `pendingBuffLogs` 버퍼로 분리해 마법 데미지 라인 후 일괄 푸시. 헤더 카운트 `totalAttacks` → `totalSlots + bonusAttacks` (버프 슬롯도 "공격" 한 번으로 카운트해 사용자 슬롯 인식과 일치). 3개 resolver(`resolve-dispatch` / `resolve-boss-dispatch` / `simulate-coop`) 동기 적용. 데미지 스킬 인라인 표기는 그대로.
- **광기의 외침 너프** — HP 30% 소모 + 5턴간 ATK +30% → HP 10% 소모 + 5턴간 ATK +15%. 1차 후반 스킬이 광전사 정체성을 침범할 만큼 강했던 부분 보수적 재조정.
- **농장 / 광산 / 훈련소 산출량 25% 하향** — `FARM_GOLD_PER_SEC` / `MINE_IRON_PER_SEC` / `TRAINING_EXP_PER_SEC` 모두 ×0.75. 활성 사냥 우대, 방치 자원·EXP 의존도 완화.
- **코옵 보상 SILVER 이상 절반 하향** — BRONZE 유지, SILVER / GOLD / EPIC / LEGEND 자원·재료 보상 ×0.5. 후반 코옵 인플레이션 보정.
- **원소술사 패시브 명칭 "자동 마법" → "마력 분출"** — 캐릭터 시트 패시브 툴팁 + 전투 로그 라벨 (`🌪 마력 분출 NN`) + 문서(docs/01·08·19) 일괄 통일. "한순간도 마법이 멈추지 않는다" 플레이버에 맞춘 명칭.
- **마을 탭 라벨 정리** — 연금 → 제작, 장비 제작 → 대장간. 기능 그대로, 명명만 명료화.
- **`DISPATCH_DURATIONS` [60, 1800, 7200, 28800] → [60, 1800, 7200]** — 8시간 옵션 폐기, 효율 곡선 1.00/0.88/0.75 (활성 플레이 우대 복원, 25% 폭). 28800 잔존 세이브는 `?? 1.0` 안전장치로 자연 정산. 전투 로그 `LOG_CAP` 500 → 7200으로 풀 보존.
- **2차 전직 레벨 캡 200 → 150** (`docs/16`) — 100~200 그라인드 후반 페이스 단축. 마일스톤·업적·도움말 동기화.
- **보상 배수 정상화** — `BOSS_REWARD_MULT` 5 → 1, `TEST_REWARD_MULT` 50 → 3 (인플레이션 보정).
- **방치형 탐험 시간 확장 + 보스 쿨다운 단축** — 단발 dispatch 길이 옵션 확장(이후 도입된 [60,1800,7200] 곡선의 전 단계).
- **숙소 HP 회복 — 탐험 중에도 적용** — 기존엔 휴식 시점만. 장시간 탐험 생존성 확보.
- **협동 보스 — 보상 테이블 모달 분리** — 카드 내부 제한 시간/티어 안내 제거, 모달로 이동.
- **직업 정체성 자원 격상** (`docs/20`) — STR/VIT/AGI/MATK가 단순 1:1 가산이던 것을 직업별 변환 계수로 격상. 전사 STR×1.3 → ATK · VIT×1.2 → DEF · VIT×3 → HP, 도적 AGI×1.2 → 회피·크리, 마법사 MATK×1.3 → INT. 각 직업이 자기 정체성 자원에서 약 +10~20% 추가 효율. 광전사 `growMult.hp` 0.6 → 0.52로 보정해 전사와 동일한 +20% HP 격상비 유지. 헬퍼 `playerDodgeChance`/`playerAgiCritChance` 신설 (적 사이드는 pure 함수 그대로). 저장 데이터 마이그레이션 불필요.
- **전투 로그 narrative 포맷** — 기존 `⚔ 데미지 (3타)` → `🎯 N회 공격! → 회차별 ⚔ 데미지의 피해를 입혔다!`
- **전투 로그 좌/우 분할** — 행위 주체별 컬럼 분리, 패시브 효과는 별도 라인(amber/violet)
- **데미지 스킬 통합** — `방패 강타 발동` + `⚒ N` 분리 → `스킬 발동! 방패 강타! N의 피해를 입혔다!` 한 줄
- **보스 카드 간소화** — 이름·HP·스킬·유니크 드랍만 (flavor·전체 스탯 제거, 전투 로그에서 확인 가능)
- **환경별 밸런스 분기** — `TEST_MODE` 자동 결정 (dev: 50× 보상/1분 쿨, prod: 1×/30분 쿨)
- **코옵 전투** — 한쪽 사망 시 즉시 종료 (이전: 30턴 강제 진행)
- **대련** — 약/중/강 3티어 → NPC + 랜덤 1명 구조
- **광전사 광폭 임계점** — 60% → 75% (역할 명확화)
- **HelpModal 갱신** — SPD 공식·코덱스 보너스·신규 시스템 안내

### 수정됨 (Fixed)

- **NotificationBell 런타임 throw로 페이지 에러 차단** — 알림 센터 컴포넌트의 잠재적 throw가 부모 트리 전체 에러로 전파되던 문제 방어 가드 추가.
- **Tooltip 모바일 좌측 잘림** — wrapper 중심 absolute 배치로 좌측 라벨(STR/AGI/INT/VIT/CRI/SPD 등)에서 화면 밖으로 밀려나가던 문제. Portal 분리 + 절대 좌표 + 좌우 viewport 클램핑 (8px 여백) + 위 공간 부족 시 placement flip + RAF 재조정 + resize/scroll 갱신.
- **풀다운 버튼 먹통** — TabNavigation `overflow-x-auto` 회귀로 모바일 풀다운이 컨테이너에 잘려 안 보이던 문제. Portal 분리 + 가로 스크롤 동시 활성화로 정상화.
- **제작 탭 보유 수량 표시** — 누적 제작 횟수가 아닌 현재 인벤토리 수량을 표시하도록 정정.
- **레거시 dispatch에서 조기 종료 버튼 무반응** — 본 기능 도입 전에 시작된 탐험은 persisted `dispatchResult`에 `treasureRolls`/`killsGoldRaw` 등 신규 필드가 없어 `cancelDispatch`가 TypeError를 던지고 set()이 막혀 "버튼이 안 눌림"처럼 보였다. 레거시 result 감지 시 부분 보상 없이 dispatch만 폐기하도록 가드 추가 (이전 동작과 동일).
- **이전 "보스 독" 표기** — 변수명 누출 → "독"으로 정정 (적측 패시브 라인)
- **보스 사망 시 시뮬레이션 30턴 강제 진행** — 즉시 종료
- **HP 바 데이터 lag** — `bossHpAfter` 미추적 → 매 턴 정확히 갱신
- **2차 직업별 스탯 격차** — 광폭/방패병 성장률 재조정

### 보안 / 운영

- API 라우트 PII 자동 마스킹 (Sentry beforeSend)
- IP 해시 (피드백 식별자) — `IP_SALT` 환경변수
- 관리자 인증 — `ADMIN_KEY`로 통일

### 기술 부채 정리

- Dead code 제거 (`enemyHitDamage`, `playerFirst`, `initialPlayerHp/finalPlayerHp` 등)
- 공통 `TurnBlock` 컴포넌트 추출 (훈련장/보스 결과창/코옵 재생 통일)
- ESLint + `tsc --strict --noUnusedLocals` 통과
- **`docs/27` 단계별 구조 리팩터** — 5단계 분할로 god 파일 해체:
  - Stage 1: `types.ts` → `types/` 16개 도메인 모듈 (character / classes / skills / equipment / regions / coop / dispatch / state 등)
  - Stage 3: `logic.ts` → 13개 도메인 모듈 추출 (skills / stats / codex / equipment-helpers / monument / progression / estate-tick / achievements / initial-state / helpers 등)
  - Stage 4: `app/*Panel.tsx` 7개 → `components/game/`로 이동 (UI 위치 일관성)
  - Stage 5: `logic.ts`의 god 함수 3개 (resolveDispatch / resolveBossDispatch / simulateCoopAttack) → `combat/{element,damage,estimate,resolve-dispatch,resolve-boss-dispatch,simulate-coop}.ts`로 분리
  - `logic.ts`는 배럴(`export * from`)만 남겨 기존 import 경로 100% 호환

### 보안 / 운영 (추가)

- **게시판 관리자 콘솔** — `/admin/board` 신고 큐 + 강제 삭제 (Stage 3)
- **대련 풀 race condition 해결** — Owner token + Redis Hash 자료구조로 닉네임 squat·동시 등록 충돌 방지

### 문서 (추가)

- **`docs/08` 보상 배수 표를 코드 값과 동기화** — `BOSS_REWARD_MULT` 5 → 1, `TEST_REWARD_MULT` 50 → 3 (코드는 이미 정상값, 문서만 outdated였음). 게임 동작 변화 0.
- **`docs/24` 원소술사 컨셉 재설계 plan** (적용 완료) — 스택+콤보 시스템, 코옵 통합, UI까지 포함.
- **`docs/26` 모바일 UI 폴리시** (P0~P2 적용 완료).
- **`docs/27` 코드 구조 리팩터** (Stage 1~5 적용 완료).
- **`docs/29` 대련 후속 백로그** — UX 토큰 안내, 본격 인증, 작은 아이디어 메모.

---

## 초기 단계 (commit 그룹)

상세 변경 이력은 git log 참조 (총 ~180개 커밋).

### 주요 마일스톤

- **MVP** (`a3fecbc`) — 텍스트 방치형 RPG 기본 구조
- **턴제 전투 + 직업/스탯 분화** (`f608b23`) — 전사·도적·마법사 + 패시브
- **인벤토리·제작 + 보물** (`951f194`) — 재료/장비 시스템
- **시간 기반 파견** (`db6c4b4`) — 비동기 탐험
- **2차 전직 + Lv 200** — 광전사·방패병·어쌔신·맹독술사·원소술사
- **명예의 전당** (`ea624ff`) — 영구 스탯 시스템
- **STR/VIT/MATK 주속성** (`704e282`) — 데미지 공식 재구성
- **보스 유니크 드랍** (`4486987`) — 11종 1% 드랍
- **대련 단순화** (`684347a`) — 3티어 → 2모드
- **전투 로그 narrative 리팩터** (`9e4d409` ~ `2879751`) — 좌/우 분할, 이모지 제거, 회차별 분리
- **운영 인프라** (`effe940` ~ `76b491b`) — 환경변수 분기, rate-limit, Sentry, 피드백, 메트릭스
- **UX 폴리싱** (`1f49a84`) — 장비 비교, 도감 진척바, 단축키, 모바일, 업적 필터, 온보딩

---

## 형식 가이드

릴리스 시 `[X.Y.Z] - YYYY-MM-DD` 헤딩 추가, 카테고리:

- 추가됨 (Added)
- 변경됨 (Changed)
- 수정됨 (Fixed)
- 제거됨 (Removed)
- 보안 (Security)
- 사용 중단 (Deprecated)
