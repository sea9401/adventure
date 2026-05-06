# 기술 / 아키텍처

> 코드: `src/lib/game/store.ts`, `src/app/globals.css`, `src/app/page.tsx`, `next-env.d.ts`

## 스택

- **Next.js 16** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** (`@theme inline`)
- **Zustand** + `persist` middleware (localStorage)
- **React 19** (use client + 서버 컴포넌트 혼합)

## 영구 저장 (Persist)

저장 키: `rpg-game-v9` (Zustand persist).
현재 버전: **3** (`store.ts:1395`).

### 마이그레이션

| 버전 | 변경                                                 |
| ---- | ---------------------------------------------------- |
| → v2 | 방패병 스킬 ID 리네임 (holy_light → provoke 등)      |
| → v3 | 코덱스 atk/def/int → str/vit/matk 환산 (주속성 도입) |

`migrate(persisted, version)` 함수에서 처리. 누락된 필드는 partial fallback으로 안전 처리.

### 저장 범위 (partialize)

```ts
{
  (character,
    resources,
    materials,
    claimedTiers,
    tutorialDismissed,
    combatLogEnabled,
    theme,
    guild,
    stats,
    achievements,
    dispatch,
    estate,
    equipmentInventory,
    log,
    hpUpdatedAt,
    bossCooldowns,
    lastBattles,
    lastCoopBattles);
}
```

토스트 / 임시 상태 (`_resolving`, `_achievementToast`, `_uniqueDropToast` 등)는 저장 제외.

## 테마 시스템

CSS 변수 기반 다크/라이트 토글:

```css
:root {
  --canvas, --panel, --panel-2,
  --line, --line-2,
  --fg-strong, --fg, --fg-muted, --fg-faint, --fg-dim,
  --rarity-craft, --rarity-drop
}

.light {
  /* 라이트 테마 오버라이드 */
}
```

Tailwind v4 `@theme inline`으로 변수를 클래스로 노출 (`bg-panel`, `text-fg-strong` 등).

`page.tsx`의 `useEffect`로 `<html>`에 `light` 클래스 토글.

`store.toggleTheme()`이 액션. 테마 값은 persist에 보관.

## 상태 관리 (Zustand store)

`src/lib/game/store.ts`의 `useGame` 훅이 진입점.

### 주요 상태

| 필드                 | 설명                                      |
| -------------------- | ----------------------------------------- |
| `character`          | 캐릭터 (직업, 레벨, EXP, 스킬, 코덱스 등) |
| `resources`          | 골드, 철                                  |
| `materials`          | 재료 인벤토리                             |
| `equipmentInventory` | 장비 개수 카운트                          |
| `estate`             | 영지 건물 레벨                            |
| `guild`              | 길드 명성                                 |
| `stats`              | 누적 통계 (총 처치, 보스킬 등)            |
| `dispatch`           | 진행 중인 탐험                            |
| `log`                | 최근 탐험 로그 (20개)                     |
| `lastBattles`        | 최근 전투 3개 (모든 종류)                 |
| `lastCoopBattles`    | 최근 코옵 전투 3개                        |
| `bossCooldowns`      | 보스별 쿨다운                             |
| `theme`              | "dark" / "light"                          |

### 핵심 액션

| 액션                                                       | 설명                           |
| ---------------------------------------------------------- | ------------------------------ |
| `tick()`                                                   | 매 초 영지 생산 + HP 회복 처리 |
| `startDispatch(regionId, sec)`                             | 일반 탐험 시작                 |
| `startBossDispatch(regionId)`                              | 보스 도전 시작                 |
| `finalizeDispatch()`                                       | 탐험 종료 + 보상 정산          |
| `coopAttack(boss)`                                         | 코옵 보스 공격 (서버 동기화)   |
| `craftEquipment(id)`                                       | 장비 제작                      |
| `equipItem(id)` / `unequipItem(slot)`                      | 장비 장착/해제                 |
| `learnSkill(id)`                                           | 2차 스킬 학습                  |
| `registerCodexMaterial(id)` / `registerCodexEquipment(id)` | 도감 등록                      |
| `allocateCodexPoint(stat)`                                 | 도감 포인트 분배               |
| `toggleTheme()`                                            | 테마 전환                      |

## 서버 API

`src/app/api/` 하위에 라우트:

- `/api/coop` — 협동 보스 (소환 / 공격 / 클레임)
- `/api/admin/*` — 관리자 (EXP grant 등)
- `/api/report` — AI 보스 처치 보고서 (Anthropic API)
- `/api/arena` — 대련 (NPC + 도전자 풀 등록 / 조회)
- `/api/chat` — 글로벌 채팅 (KV 저장)

### Rate Limiting

`src/lib/rate-limit.ts`의 `rateLimit(key, limit, windowMs)` 헬퍼로 IP별 분당 제한 적용:

| 엔드포인트    | 한도  | 윈도 |
| ------------- | ----- | ---- |
| `/api/report` | 30/분 | 60s  |
| `/api/coop`   | 60/분 | 60s  |
| `/api/arena`  | 30/분 | 60s  |
| `/api/chat`   | 10/분 | 60s  |

KV가 있으면 KV 카운터, 없으면 인메모리 fallback. 초과 시 `429 Too Many Requests` + `Retry-After` 헤더.

## 환경별 밸런스 분기

`src/lib/game/data.ts`의 `TEST_MODE` 상수가 다음 값을 분기:

- 개발(`NODE_ENV !== "production"`) 또는 `NEXT_PUBLIC_TEST_MODE=1` → 테스트값
- 운영(prod 빌드) → 정상값

| 상수               | 테스트값 | 운영값 |
| ------------------ | -------- | ------ |
| `BOSS_COOLDOWN_MS` | 1분      | 30분   |
| `TEST_REWARD_MULT` | 50       | 1      |

스테이징 / QA 환경에서 테스트값을 강제하려면 `NEXT_PUBLIC_TEST_MODE=1` 환경 변수 설정.

## 전투 로그 컴포넌트 구조

```
BattleLogTurn.tsx     # 공통 TurnBlock + 이벤트 분류기 (모든 화면 공유)
BattleLogViewer.tsx   # 보스/필드/대련 결과 모달
TrainingPanel.tsx     # 훈련장 (인라인 로그 누적)
CoopBossPanel.tsx     # 코옵 (CoopAttackPlayback 인라인)
```

이벤트 분류 (이모지 prefix 기반):

- `isPassiveEvent`: 가시 / 흡혈 / 카운터 / 반사 / DOT / 사형 등 비-턴 이벤트
- `isEnemyEvent`: 보스 액션, 받는 데미지, 회피 등
- `passiveRecipient`: 패시브 효과의 수혜측 (player / enemy)

표시 시 `stripLeadEmoji`로 선두 이모지 제거.

## 아키텍처 메모

- **데이터 분리**: 모든 게임 밸런스 / 상수 / 정의는 `data.ts`. 런타임 로직은 `logic.ts`. 상태는 `store.ts`.
- **테스트 멀티**: `TEST_REWARD_MULT = 50`이 적용되어 있어 출시 시 조정 필요
- **이펙트 분류**: SkillEffect는 discriminated union (`kind` 필드). 새 효과 추가 시 simulator 3곳 (resolveDispatch, resolveBossDispatch, simulateCoopAttack) 모두 처리 필요
- **AGENTS.md 주의**: 이 프로젝트는 Next.js 16 변형으로 일반적인 Next.js 문서와 다른 점이 있을 수 있음. `node_modules/next/dist/docs/` 참고 권장
