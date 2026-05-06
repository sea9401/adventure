# 27. 코드 구조 정리 — `lib/game` 분할 + 패널 재배치

> **상태**: 진행 중 (단계별로 갱신)
> **관련 코드**: `src/lib/game/data.ts`(2,756줄), `src/lib/game/logic.ts`(3,581줄), `src/lib/game/types.ts`(927줄), `src/lib/game/store.ts`(1,840줄), `src/app/*Panel.tsx`(7개)
> **선행**: `docs/14-code-structure-refactor-plan.md`(Phase 1: 컴포넌트 분리 — 적용 완료)

## 0. 한 문장 요약

`lib/game/`의 4개 god 파일(총 9,104줄)을 도메인별로 쪼개고 패널 컴포넌트를 `app/`에서 `components/game/panels/`로 이동해 **"코드 위치를 즉시 찾을 수 있는 구조"**로 만든다.

## 1. 현재 상태 진단

| 파일                |   라인 | exports | 문제                                                                                                      |
| ------------------- | -----: | ------: | --------------------------------------------------------------------------------------------------------- |
| `lib/game/logic.ts` |  3,581 |      65 | god 함수 3개(`resolveDispatch` 957줄, `resolveBossDispatch` 990줄, `simulateCoopAttack` 692줄) — 74% 차지 |
| `lib/game/data.ts`  |  2,756 |      60 | regions/equipment/classes/skills/achievements/sets 한 파일                                                |
| `lib/game/types.ts` |    927 |      65 | 모든 타입 한 파일                                                                                         |
| `lib/game/store.ts` |  1,840 |       2 | 모든 zustand 액션 한 파일                                                                                 |
| `app/*Panel.tsx`    | 7 파일 |       — | 패널 컴포넌트가 라우팅 폴더에 위치                                                                        |

**접근성 체감 시나리오**:

- "어쌔신 스킬 효과 바꾸기" → `data.ts` 2,756줄 grep
- "보스 데미지 공식 디버그" → `logic.ts`의 `resolveBossDispatch` 990줄
- "탐험 액션 추가" → `store.ts` 1,840줄

## 2. 비목표 (본 PR 범위 외)

- **god 함수 3개 통합** — `resolveDispatch / Boss / Coop`의 80% 중복 로직 통합은 별도 후속 작업. 본 PR은 위치만 이동.
- **동작 변경** — 순수 위치/import 변경만, 비즈니스 로직 수정 0.
- **store.ts 슬라이스 분할** — zustand persist middleware + 액션 간 의존성으로 복잡도 큼. 별도 후속 PR로.
- **API 라우트 / Sentry / Analytics** 구조는 그대로.

## 3. 목표 구조

```
src/lib/game/
├── data/                    # ⬆️ 신규 (구 data.ts 분할)
│   ├── index.ts             # 배럴 — 기존 import 경로 유지
│   ├── balance.ts           # LEVEL_CAP, DISPATCH_DURATIONS, AGI_DODGE_RATE 등 상수
│   ├── classes.ts           # CLASSES (1차)
│   ├── advanced-classes.ts  # ADVANCED_CLASSES (2차)
│   ├── skills.ts            # SKILLS, getSkillsByClass 등
│   ├── regions.ts           # REGIONS, REGION_GROUPS
│   ├── equipment.ts         # EQUIPMENT, SETS, 장비 제작/세트
│   ├── materials.ts         # MATERIALS
│   ├── achievements.ts      # ACHIEVEMENTS
│   ├── coop.ts              # COOP_BOSSES + 관련 상수
│   ├── crafting.ts          # CRAFTABLES
│   └── monument.ts          # MONUMENT_TROPHIES, MONUMENT_KILL_CAP 등
├── types/                   # ⬆️ 신규 (구 types.ts 분할)
│   ├── index.ts             # 배럴
│   ├── primitives.ts        # ResourceKind, Resources, MaterialKind, Materials
│   ├── character.ts         # Character, CharacterClass, AdvancedClassId, Stats, ClassDef, ...
│   ├── skills.ts            # SkillId, SkillTrigger, SkillEffect, ClassPassive
│   ├── equipment.ts         # EquipmentId, EquipmentSlot, EquipmentBonus, EquipmentDef, SetId
│   ├── enemies.ts           # Enemy, BossDef
│   ├── regions.ts           # Region, RegionGroup, Treasure
│   ├── dispatch.ts          # Dispatch, DispatchResult, DispatchLogEntry, BossDispatchResult, BossCombatLogEntry, LastBattle, LogEntry
│   ├── coop.ts              # CoopBossDef, ActiveCoopBoss, CoopRewardTier, CoopAttackResult
│   ├── arena.ts             # ArenaSnapshot, ArenaTier
│   ├── achievements.ts      # AchievementId, AchievementDef, AchievementClaim
│   ├── codex.ts             # CodexState, CodexStatKey
│   ├── estate.ts            # Estate
│   └── state.ts             # GameState, Guild, GameStats
├── combat/                  # ⬆️ 신규 (구 logic.ts 일부 분할)
│   ├── damage.ts            # computePlayerDamage, dodgeChance, agiCritChance, playerDodgeChance, ...
│   ├── skills.ts            # getActivePassive, getEquippedSkills, applySkillEffects 등
│   ├── resolve-dispatch.ts  # resolveDispatch
│   ├── resolve-boss-dispatch.ts  # resolveBossDispatch
│   └── simulate-coop.ts     # simulateCoopAttack
├── stats.ts                 # computeStats, MonumentExtra
├── equipment-helpers.ts     # getEquipmentBonuses, getEquipmentCritBonus, getSetCounts, getSetBonuses, getEquipmentResourceCost ...
├── codex.ts                 # CODEX_* 상수, getCodexEntries / EarnedPoints / Bonus, ensureCodex
├── progression.ts           # applyExp, expForLevel, getLevelCap, LEVEL_MILESTONES, getCrossedMilestones, classes change 함수들
├── achievements.ts          # checkAchievements, AchievementClaim 처리
├── monument.ts              # getMonumentBonus
├── arena.ts                 # 기존
├── helpers.ts               # findRegion, randInt, addMaterials, subtractMaterials, canCraft, hasMaterials, canAfford, subtractCost
├── initialState.ts          # initialState (Character + Game)
└── store.ts                 # 그대로 (단계 외)

src/components/game/
├── panels/                  # ⬆️ 신규 (구 app/*Panel.tsx 이동)
│   ├── ArenaPanel.tsx
│   ├── CodexPanel.tsx
│   ├── CoopBossPanel.tsx
│   └── TrainingPanel.tsx
├── battle-log/              # ⬆️ 신규
│   ├── BattleLogViewer.tsx
│   └── BattleLogTurn.tsx
├── ChatWidget.tsx           # ⬆️ 이동 (구 app/ChatWidget.tsx)
└── (기존 파일들)
```

## 4. 단계별 작업 (commit 분리)

각 단계 끝에 `tsc --noEmit` + `eslint` 통과 + dev 서버 정상 동작 확인.

### Stage 1 — `types.ts` 분할

**가장 먼저** 진행하는 이유: types는 다른 모든 모듈의 의존 대상이라 가장 적게 영향받고, barrel(`types/index.ts`)이 기존 `from "./types"` import를 그대로 유지시킴.

- 14개 도메인 파일로 분할
- `types/index.ts` 배럴이 모든 타입 re-export → 기존 import 경로 100% 호환
- 추후 직접 경로 import(`from "./types/dispatch"`)로 점진 마이그레이션 가능

**검증**: `git grep -l "from.*types" src/` 의 모든 파일이 빌드 통과.

### Stage 2 — `data.ts` 분할

- 12개 도메인 파일로 분할
- `data/index.ts` 배럴
- 기존 import 경로 호환

**검증**: 동일.

### Stage 3 — `logic.ts` 분할

가장 큰 작업. 신규 디렉토리:

- `combat/` — 전투 시뮬 (3 god 함수 + 데미지/스킬 헬퍼)
- 그 외는 도메인별 단일 파일 (`stats.ts`, `equipment-helpers.ts`, `codex.ts`, `progression.ts`, `achievements.ts`, `monument.ts`, `helpers.ts`, `initialState.ts`)
- **`logic.ts` 자체는 배럴로 보존** → 기존 import 경로 호환

god 함수 3개는 각각 한 파일에 들어가지만 통합은 안 함 (비목표).

**검증**: 동일. 추가로 `npm run build` (Next.js prod build)도 확인.

### Stage 4 — 패널 재배치

`app/*Panel.tsx` + `app/Battle*.tsx` + `app/ChatWidget.tsx` 7개 파일 이동:

- `app/ArenaPanel.tsx` → `components/game/panels/ArenaPanel.tsx`
- `app/CodexPanel.tsx` → `components/game/panels/CodexPanel.tsx`
- `app/CoopBossPanel.tsx` → `components/game/panels/CoopBossPanel.tsx`
- `app/TrainingPanel.tsx` → `components/game/panels/TrainingPanel.tsx`
- `app/BattleLogViewer.tsx` → `components/game/battle-log/BattleLogViewer.tsx`
- `app/BattleLogTurn.tsx` → `components/game/battle-log/BattleLogTurn.tsx`
- `app/ChatWidget.tsx` → `components/game/ChatWidget.tsx`

`app/page.tsx`의 import 경로 일괄 갱신.

**주의**: `app/page.tsx`는 사용자가 별도 작업 중일 수 있음 — Stage 4 시점에 git status 재확인 후, 충돌 없으면 진행. 충돌 시 사용자 작업 우선 commit 후 진행.

## 5. 검증 플랜

각 단계마다:

1. `npx tsc --noEmit` — 타입 통과
2. `npx eslint <touched-files>` — 린트 통과
3. `git status` — 의도하지 않은 변경 없는지 확인
4. dev 서버 또는 `npm run build` — 런타임 sanity check (마지막 단계 후 1회)

각 단계 commit:

```
refactor(structure): Stage N — <area> 분할

- N개 신규 파일 생성 (...)
- 배럴 파일로 기존 import 경로 100% 호환
- 동작 변경 0, 순수 위치 이동만

Co-Authored-By: ...
```

## 6. 완료 후 후속 작업 (별도 PR 권장)

- **god 함수 3개 통합** — `simulateCombat(scenario, character, opponent, options)` 단일 엔진 (3개 함수의 80% 중복 통합)
- **store.ts 슬라이스 분할** — zustand 슬라이스 패턴으로 도메인별 액션 묶음
- **직접 경로 import 마이그레이션** — `from "./types"` → `from "./types/dispatch"` 점진 (선택)

## 7. 진행 기록

- [x] Stage 1 — `types.ts` 분할 (16개 도메인 파일 + index 배럴) — `731a2d3`
- [x] Stage 2 — `data.ts` 분할 (12개 도메인 파일 + index 배럴) — `b6982b0`
  - 주의: 본 커밋은 TabNavigation Portal 변경(다른 작업)과 의도치 않게 같은 커밋에 묶임. 메시지는 TabNavigation만 언급하지만 14개 신규 파일(`data/*.ts`) + 구 `data.ts` 삭제도 함께 적용됨. 동작 영향은 없음 — 두 변경이 독립적이라 빌드 통과.
- [x] Stage 3 — `logic.ts` helper 13개 모듈 추출 + 배럴화 — `d3e7ee4`
- [x] Stage 4 — 패널 재배치 (7개 파일 components/game/ 하위로 이동) — `5c8f88f`
- [x] Stage 5 (후속) — god 함수 3개 → `combat/resolve-dispatch.ts`/`resolve-boss-dispatch.ts`/`simulate-coop.ts` 분리. logic.ts는 22줄 순수 배럴.

각 단계 완료 시 `[x]` 체크 + commit 해시 추가.
