# 30. UX 폴리싱 3종 — 보스 진행 시각화 / 인벤토리 정렬·필터 / 첫 진입 가이드

> **상태**: 설계안 / 진행 예정 (한 PR 묶음)
> **관련 코드**: `src/app/tabs/ExploreTab.tsx` (보스 카드), `src/app/tabs/InventoryTab.tsx` (인벤토리), `src/app/tabs/HomeTab.tsx` (홈), `src/lib/game/types/state.ts` (`bossKillCounts`)
> **연관 문서**: `docs/11-ux-polish-plan.md` (앞선 UX 폴리싱), `docs/26-mobile-ui-polish-execution-plan.md` (모바일 폴리싱)

## 0. 한 문장 요약

기존 정보를 더 시각적으로 노출(보스 처치 상태) + 양이 많아진 데이터를 정리(인벤토리 정렬·필터) + 첫 사용자가 막히지 않도록 다음 단계 안내(홈 추천 카드).

## 1. 보스 카드 진행 상태 시각화

### 1.1 현재 문제

`ExploreTab`에서 11개 필드 보스 카드를 일렬로 보여주는데:

- 어느 보스를 처치했는지 / 못 했는지 즉시 인지 어려움
- 누적 처치 횟수가 어디에도 노출 안 됨 (`stats.bossKillCounts`엔 있음)
- 유니크 드랍을 이미 받은 적 있는지 카드만 봐선 모름

### 1.2 변경

각 보스 카드에 **상태 배지** 추가 (이름 옆 또는 카드 우상단):

| 상태                                                  | 시각                                |
| ----------------------------------------------------- | ----------------------------------- |
| 미도전 (`bossKillCounts[name]` 없음)                  | 🔒 (회색) + 카드 헤더 살짝 dim      |
| 처치 1회+ (`>= 1`)                                    | ✓ 처치 N회 (emerald-400, 작은 글자) |
| 유니크 드랍 보유 (`codex.equipment`에 unique ID 포함) | ★ (amber-300) 추가                  |

### 1.3 코드 변경

`ExploreTab.tsx` 보스 카드 렌더 부분:

```ts
const killCount = state.stats.bossKillCounts[r.boss.name] ?? 0;
const uniqueId = r.boss.uniqueDrop?.id;
const codex = ensureCodex(state.character.codex);
const hasUnique = uniqueId ? codex.equipment.includes(uniqueId) : false;
```

배지 컴포넌트 (인라인 또는 작은 helper):

```tsx
{
  killCount === 0 ? (
    <span className="text-xs text-fg-faint">🔒 미도전</span>
  ) : (
    <span className="text-xs text-emerald-400">✓ 처치 {killCount}회</span>
  );
}
{
  hasUnique && <span className="text-xs text-amber-300 ml-1">★</span>;
}
```

### 1.4 작업량

`ExploreTab.tsx` 보스 카드 한 곳 수정 — **~20줄**.

## 2. 인벤토리 정렬·필터

### 2.1 현재 문제

장비 아이템이 누적되면 `InventoryTab`이 길어져 원하는 장비 찾기 어려움. 슬롯 그룹화·정렬이 약함.

### 2.2 변경

상단에 **컨트롤 바** 추가:

```
[검색: ____] [슬롯: 전체|머리|몸|장갑|신발|무기|반지] [정렬: 슬롯/등급/이름] [☑미장착만]
```

- **검색**: 이름 부분 일치 (한국어 정렬 `localeCompare`)
- **슬롯 토글**: 1개 선택 또는 "전체"
- **정렬**: 기본=슬롯 / 등급 (드랍 > 보스제작 > 일반) / 이름 가나다순
- **미장착만 토글**: `equipped[slot] !== id` 인 항목만

### 2.3 코드 변경

`InventoryTab.tsx`에 `useState`로 4개 컨트롤 + `useMemo`로 필터/정렬 결과 계산.

타입:

```ts
type SortKey = "slot" | "rarity" | "name";
type SlotFilter = "all" | EquipmentSlot;
```

등급 비교용 helper:

```ts
const rarityRank = (def: EquipmentDef): number => (def.dropOnly ? 2 : def.bossLabel ? 1 : 0);
```

`useMemo`로 필터 + 정렬 결과를 state-dependent로 계산. 기존 카드 렌더는 그대로 유지하고 입력 데이터만 교체.

### 2.4 작업량

`InventoryTab.tsx` 컨트롤 UI + 필터/정렬 로직 — **~80줄**.

## 3. 홈 화면 — 중기 진행 카드 (TutorialChecklist 후속)

### 3.1 현재 상황

기존 `TutorialChecklist`(8단계)가 초반 가이드를 충실히 다룬다 — 이름 / 첫 탐험 / 첫 적 / 첫 장비 / 장착 / 첫 보스 / 영지 / 직업 변경. 모두 완료되거나 사용자가 dismiss하면 사라진다.

문제: 그 이후 (Lv 30+) 다음 큰 목표가 시야에서 사라짐. 명예의 전당·2차 전직·코덱스 포인트 분배 등을 사용자가 모를 수도.

### 3.2 변경

`NextMilestoneCard` 신규 컴포넌트 — TutorialChecklist가 비활성(완료 또는 dismiss)일 때만 표시. 다음 큰 마일스톤 1개만 큼지막하게.

추천 규칙 (단계별, 첫 매칭 1개):

| 우선 | 조건                                              | 카드 내용                                     | 액션 탭 |
| ---- | ------------------------------------------------- | --------------------------------------------- | ------- |
| 1    | `level >= 100 && !character.advancedClass`        | "Lv 100 도달 — 2차 전직 도전"                 | 직업    |
| 2    | `level >= 30 && (estate.monument ?? 0) === 0`     | "명예의 전당 — 보스 트로피로 영구 스탯 강화"  | 영지    |
| 3    | `getCodexAvailablePoints(codex) > 0`              | "도감 포인트 N점 미사용 — 분배해 즉시 강해짐" | 도감    |
| 4    | `level >= 30 && stats.totalCoopBossDefeats === 0` | "협동 보스 도전 — 산군"                       | 코옵    |
| 5    | `bossDefeatedNames.length < 11`                   | "다음 보스 도전 — N마리 미처치"               | 탐험    |
| 6    | (모두 만족)                                       | 카드 숨김                                     | —       |

### 3.3 코드 변경

`HomeTab.tsx`에 `getNextStep()` 헬퍼와 카드 컴포넌트 추가. 액션 버튼은 `onTabChange` prop으로 탭 전환.

```ts
type NextStep = {
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
} | null;

function getNextStep(state, onTabChange, onExploreGroupChange): NextStep {
  if (state.stats.totalDispatches === 0) return { ... };
  if (...) return { ... };
  return null;
}
```

### 3.4 노출 조건

- `tutorialDismissed === true` 라도 표시 (튜토리얼과 별개)
- 사용자가 "이제 그만 보기" 클릭 시 `nextStepDismissed: number` (timestamp) 저장 → 24h 동안 숨김 (또는 영구 dismiss 토글)

이번 PR에서는 **dismiss 없이 항상 표시 — 단계 만족 시 자동 다음 단계로 이동**. 사용자 피드백 보고 dismiss 추가 검토.

### 3.5 작업량

`HomeTab.tsx` 헬퍼 + 카드 UI — **~70줄**.

## 4. 통합 작업 순서

1. **types/state — 변경 없음** (모두 기존 필드 활용)
2. **`ExploreTab.tsx`** — 보스 카드 배지 (1번)
3. **`InventoryTab.tsx`** — 컨트롤 바 + 필터/정렬 (2번)
4. **`HomeTab.tsx`** — 다음 단계 카드 (3번)
5. `npx tsc --noEmit` / `npm run lint` / `npm run build`
6. 커밋 — 각 항목 별도 커밋이 가독성 좋음 (PR은 하나)

## 5. 디자인 일관성

- 색상 팔레트: 기존 emerald-400 (성공/처치) / amber-300 (강조/유니크) / fg-faint (미도전) / sky-400 (정보) 그대로 사용
- 카드 외곽선: `border border-line` / hover: `border-emerald-600`
- 모바일: 컨트롤 바는 `flex-wrap` + 작은 화면에서 검색·정렬·필터를 2줄로

## 6. 미적용 (후속)

- 인벤토리 다중 슬롯 필터 (현재는 단일 슬롯 또는 전체)
- 정렬 방향 토글 (오름차순/내림차순) — 기본 1방향만
- 다음 단계 카드의 "건너뛰기" 또는 "다시 보지 않기" 액션 — 사용자 피드백 후 결정
- 보스 카드 호버 시 누적 평균 클리어 턴 표시 — `bossClearStats`에 데이터 있음

## 7. 검증

- 첫 사용자(상태 비움): A 단계 카드 표시 확인
- Lv 100 캐릭터: E 단계 카드 표시 확인
- 인벤토리 100개+ 시나리오: 필터로 즉시 좁힘 확인
- 보스 처치 직후: 카드에 "✓ 처치 1회" 즉시 반영 확인

## 8. 작업량 요약

| 항목                  | 줄 수 (예상) | 우선 |
| --------------------- | ------------ | ---- |
| 1. 보스 카드 배지     | ~20          | 1    |
| 2. 인벤토리 정렬/필터 | ~80          | 2    |
| 3. 홈 다음 단계 카드  | ~70          | 3    |
| **합계**              | **~170줄**   | 1 PR |
