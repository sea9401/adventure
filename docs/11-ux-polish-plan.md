# UX 폴리싱 구현 계획

> 출시 전후 사용자 경험을 다듬는 작은 작업들의 계획서. 각 항목 별로 코드베이스 현황, 변경 위치, 예상 작업량을 명시.

## 코드베이스 사전 점검 결과

| 자산                           | 위치                                          | 활용                                           |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------- |
| `Tooltip` 컴포넌트 (2786)      | `src/app/page.tsx`                            | 동일 컴포넌트 재사용 — multiline 옵션 있음     |
| `HelpModal` (2901)             | `src/app/page.tsx`                            | 도움말 본문 보강 시 여기                       |
| `시작 가이드` (StartHelp 2680) | `src/app/page.tsx`                            | 8단계 체크리스트 이미 존재. 보강 가능          |
| `tutorialDismissed` flag       | store / page.tsx                              | 가이드 영구 숨김 여부                          |
| Codex 진척도                   | `src/app/CodexPanel.tsx:73-93`                | 숫자 표시는 있지만 **진척바 없음**             |
| 업적 카테고리 필터             | `src/app/page.tsx:1748`                       | 카테고리 탭은 있지만 **완료/미완료 필터 없음** |
| 모바일 반응형                  | sm: 일부 적용, 좌/우 분할 전투 로그 점검 필요 | 폭 좁을 때 컬럼 깨질 가능성                    |
| 키보드 단축키                  | **없음**                                      | 신규 도입                                      |
| 장비 비교 툴팁                 | **없음**                                      | 인벤토리 장비 카드에 추가                      |

### 주의 사항

- `page.tsx`가 3,269줄로 비대 — 큰 신규 컴포넌트는 별도 파일로 분리.
- `Tooltip` 컴포넌트는 클릭/호버 모두 지원 (`pinned` 상태). 모바일에서도 동작.
- 글로벌 키보드 핸들러는 input/textarea 포커스 시 비활성 필요.
- 업적 카테고리 변경 시 사용자 컨텍스트 보존 (`localStorage` 또는 store).

---

## 1. 장비 슬롯 비교 툴팁 (★ 추천 1순위)

### 목표

인벤토리에서 장비 카드에 hover (모바일은 탭) 시, 현재 장착 장비 대비 스탯 차이를 즉시 확인.

### UI 디자인

```
[장갑] 가시 가죽 장갑       ×3
       ATK +5, AGI +2
       [장착] [도감 등록]

  ↓ hover/tap

┌─ 현재 장착품: 슬라임 장갑 ─┐
│  ATK +2, HP +10            │
├─ 변경 시 ────────────────┤
│  ATK   +3 ↑                │
│  HP    -10 ↓               │
│  AGI   +2 ↑                │
└─────────────────────────────┘
```

장착 중인 장비는 비교 툴팁 X (기준이 자기 자신).
같은 슬롯에 장착된 게 없으면 "장착 중인 장비 없음 — 장착 시 +N" 단순 표시.

### 데이터 흐름

이미 `state.character.equipped[slot]`이 현재 장착 ID. `EQUIPMENT[id].bonus`로 스탯 비교.

### 변경 파일

| 파일                                         | 종류 | 내용                                              |
| -------------------------------------------- | ---- | ------------------------------------------------- |
| `src/components/EquipmentCompareTooltip.tsx` | 신규 | 비교 표시 컴포넌트                                |
| `src/app/page.tsx`                           | 수정 | 인벤토리 슬롯별 장비 카드 (1340 부근)에 툴팁 wrap |

### 구현 스니펫

```tsx
// src/components/EquipmentCompareTooltip.tsx
import type { EquipmentBonus, EquipmentDef, EquippedItems } from "@/lib/game/types";
import { EQUIPMENT } from "@/lib/game/data";

const STAT_LABEL: Record<keyof EquipmentBonus, string> = {
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  mdef: "MDEF",
  spd: "SPD",
  agi: "AGI",
  int: "INT",
  str: "STR",
  vit: "VIT",
  matk: "MATK",
  crit: "CRI",
  dotAmp: "DOT",
};

const subtractBonus = (a: EquipmentBonus, b: EquipmentBonus): EquipmentBonus => {
  const out: EquipmentBonus = {};
  const keys = new Set<keyof EquipmentBonus>([
    ...(Object.keys(a) as (keyof EquipmentBonus)[]),
    ...(Object.keys(b) as (keyof EquipmentBonus)[]),
  ]);
  for (const k of keys) {
    const diff = (a[k] ?? 0) - (b[k] ?? 0);
    if (diff !== 0) (out as Record<string, number>)[k] = diff;
  }
  return out;
};

export function EquipmentCompareTooltip({
  candidate,
  equipped,
}: {
  candidate: EquipmentDef;
  equipped: EquippedItems | undefined;
}) {
  const current = equipped?.[candidate.slot] ? EQUIPMENT[equipped[candidate.slot]!] : null;
  if (!current) {
    return (
      <div className="text-xs">
        <p className="text-fg-faint mb-1">장착 중인 장비 없음</p>
        {Object.entries(candidate.bonus).map(([k, v]) =>
          v ? (
            <p key={k} className="text-emerald-400">
              +{v} {STAT_LABEL[k as keyof EquipmentBonus]}
            </p>
          ) : null,
        )}
      </div>
    );
  }
  const diff = subtractBonus(candidate.bonus, current.bonus);
  return (
    <div className="text-xs space-y-0.5">
      <p className="text-fg-faint">현재: {current.name}</p>
      {Object.entries(diff).map(([k, v]) => {
        if (!v) return null;
        const positive = v > 0;
        return (
          <p key={k} className={positive ? "text-emerald-400" : "text-red-400"}>
            {STAT_LABEL[k as keyof EquipmentBonus]} {positive ? "+" : ""}
            {v} {positive ? "↑" : "↓"}
          </p>
        );
      })}
    </div>
  );
}
```

### 작업량

**0.5일** (컴포넌트 + 1곳 wrap + 디자인 다듬기)

---

## 2. 첫 사용자 온보딩 보강

### 현황

- `시작 가이드` 컴포넌트가 8단계 체크리스트로 이미 존재 (page.tsx:2680)
- `tutorialDismissed`로 영구 숨김 가능
- 다만 첫 진입 시 **무엇이 있는지** 안내가 부족

### 보강 방향

1. **첫 진입 모달**: 캐릭터 이름 미설정 + `firstVisit` 플래그가 없을 때 환영 + 핵심 기능 3장 슬라이드
2. **현재 단계 강조**: 가이드 박스에 "👉 다음: [현재 단계]" 표시
3. **스킵 후 재호출**: 헤더 "?" 버튼 옆에 "🎯 가이드 다시 보기" 추가

### 변경 파일

| 파일                              | 종류 | 내용                                 |
| --------------------------------- | ---- | ------------------------------------ |
| `src/components/WelcomeModal.tsx` | 신규 | 3장 환영 슬라이드                    |
| `src/app/page.tsx`                | 수정 | 첫 진입 감지 + 가이드 보강           |
| `src/lib/game/types.ts`           | 수정 | `welcomeShown?: boolean` 플래그 추가 |
| `src/lib/game/store.ts`           | 수정 | `dismissWelcome()` 액션              |

### 환영 모달 콘텐츠 (제안)

1. **방치형 RPG에 오신 것을 환영합니다** — 컨셉 한 줄, 어떤 게임인지
2. **클래스 선택 → 탐험 → 보스 처치** — 핵심 루프
3. **시작 가이드를 따라가세요** — 화면 가운데 가이드 박스 위치 가리키며 마무리

작은 그림 / 이모지 + 한국어 짧은 문장. 모달 닫으면 `welcomeShown = true`.

### 작업량

**1일** (모달 + 진입 로직 + 가이드 강조 표시)

---

## 3. 모바일 반응형 점검

### 현황

- `sm:` breakpoint 일부 적용 (헤더, 자원 표시, 통계 grid)
- **전투 로그 좌/우 분할** (`grid grid-cols-2` 고정) — 좁은 화면에서 컬럼이 너무 좁아 텍스트 줄바꿈 다발
- HP 바 영역 (`w-[80%]`) — 모바일에서 좁아 보임
- 보스 정보 카드, 인벤토리 장비 카드의 가로 정렬 점검 필요

### 우선순위 점검 영역

| 영역                      | 폭 360~480px에서 문제        | 해결                                           |
| ------------------------- | ---------------------------- | ---------------------------------------------- |
| 전투 로그 (BattleLogTurn) | 좌/우 컬럼 좁음              | 모바일에선 세로 스택 (`md:grid-cols-2`로 변경) |
| HP 바 (BattleLogTurn)     | 80% 너비가 너무 작음         | 모바일은 100%                                  |
| 헤더 자원 표시            | 골드/철 텍스트 잘림          | `truncate` 추가                                |
| 탭 네비게이션             | 가로 스크롤?                 | `overflow-x-auto` 확인                         |
| 인벤토리 장비 카드        | 비교 툴팁 위치               | 화면 폭 넘치면 위/아래로                       |
| 모달                      | 가로 80% / max-w 사용 일관성 | 통일                                           |

### 변경 파일

| 파일                        | 종류                                    |
| --------------------------- | --------------------------------------- |
| `src/app/BattleLogTurn.tsx` | grid breakpoint 추가 (`md:grid-cols-2`) |
| `src/app/page.tsx`          | 헤더 / 탭 네비 정렬 점검                |
| `src/app/globals.css`       | (필요 시) 미디어 쿼리 보강              |

### 검증 절차

- Chrome DevTools 디바이스 토글: iPhone SE(375), iPhone 12 Pro(390), iPad mini(768)
- 각 탭별로 클릭 / hover / 모달 흐름 확인
- 전투 로그 모달의 스크롤이 모바일에서 정상 동작

### 작업량

**1일** (점검 + 깨진 부분 수정 + 디바이스별 캡처 1회)

---

## 4. 도감 진척도 시각화

### 현황

`CodexPanel.tsx:73-93`에 숫자만 표시 (X/Y 항목, 포인트 N/M). 진척바 없음.

### 보강

```
📖 기록의 서 진척도                  87/220 항목
┌─────────────────────────────────────────────┐
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ 39.5%
└─────────────────────────────────────────────┘

총 포인트  사용  잔여  다음 포인트까지
17/44     12    5     3항목
└─ 다음 진척까지 ──────────────────────────┐
│ ████████████░░░ │
└────────────────┘ 2/5
```

추가 그래픽:

- 메인 진척바 (X/Y 항목 / 색: amber)
- 다음 포인트까지 미니 바 (현재 N/5)

### 변경 파일

`src/app/CodexPanel.tsx` 수정 (단일 파일).

### 구현 스니펫

```tsx
// 메인 진척바
const overallPct = (entries / Math.max(1, totalPossibleEntries)) * 100;

<div className="h-2 bg-panel-2 rounded-full overflow-hidden">
  <div
    className="h-full bg-amber-500 transition-all"
    style={{ width: `${overallPct}%` }}
  />
</div>
<p className="text-[10px] text-fg-faint tabular-nums text-right">
  {overallPct.toFixed(1)}%
</p>

// 다음 포인트까지 미니 바
const sinceLastPoint = entries % CODEX_ENTRIES_PER_POINT;
const nextPct = (sinceLastPoint / CODEX_ENTRIES_PER_POINT) * 100;

<div className="h-1.5 bg-panel-2 rounded-full overflow-hidden mt-2">
  <div
    className="h-full bg-emerald-500"
    style={{ width: `${nextPct}%` }}
  />
</div>
```

### 작업량

**0.5일**

---

## 5. 업적 카테고리 필터 + 완료/미완료 표시

### 현황

- 카테고리 탭(first/boss/combat/etc) 존재
- 모든 항목을 카테고리 안에서 일괄 표시 — 완료/미완료 시각 구분 약함
- 진행률 / 완료 비율 헤더 없음

### 보강

```
📜 업적

[전체] [첫걸음] [보스] [전투] [기타]   완료 12/47

[필터: ☑ 완료 ☑ 진행 중 ☐ 미시작]   ↓ 정렬: 진행률

┌─ 첫 보스 ────────────────────── ✅ ────┐
│ 첫 필드 보스를 처치한다.                  │
│ 보상: 골드 500                          │
└────────────────────────────────────────┘

┌─ 슬라임 (3등급) ─────────────────────────┐
│ 거대 슬라임 왕 처치 — 다음 4등급 (100회)   │
│ 진행: ████████░░░░░░░░ 67/100           │
└────────────────────────────────────────┘
```

추가 요소:

- 카테고리 탭에 (완료수/총개수) 표시
- "완료 / 진행 / 미시작" 토글 (3개)
- 정렬: 기본 / 진행률 / 보상 크기 (선택)

### 변경 파일

`src/app/page.tsx`의 업적 탭 섹션 (1715~1860 부근) — 단일 파일 수정.
사이즈가 크면 별도 컴포넌트로 분리 (`src/components/AchievementsPanel.tsx`).

### 작업량

**1일** (필터 상태 + 진행률 정렬 + 시각 다듬기)

---

## 6. 키보드 단축키

### 키 매핑 (제안)

| 키    | 동작                         |
| ----- | ---------------------------- |
| `1`   | 홈 탭                        |
| `2`   | 탐험 탭                      |
| `3`   | 코옵 탭                      |
| `4`   | 대련 탭                      |
| `5`   | 훈련장 탭                    |
| `6`   | 인벤토리 탭                  |
| `7`   | 도감 탭                      |
| `?`   | 도움말 모달                  |
| `Esc` | 모달 / 모드 닫기             |
| `r`   | 자동 공격 토글 (훈련장 한정) |

### 변경 파일

| 파일                  | 종류                        |
| --------------------- | --------------------------- |
| `src/lib/keyboard.ts` | 신규 — 글로벌 핸들러 + 매핑 |
| `src/app/page.tsx`    | 수정 — 핸들러 등록          |

### 구현 스니펫

```ts
// src/lib/keyboard.ts
export type KeyHandler = { key: string; action: () => void; description: string };

export function attachShortcuts(handlers: KeyHandler[]): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    // 입력 포커스 중엔 무시
    const target = e.target as HTMLElement | null;
    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable
    ) {
      return;
    }
    // Cmd/Ctrl/Meta 조합은 무시 (브라우저 단축키 보호)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const handler = handlers.find((h) => h.key === e.key);
    if (handler) {
      e.preventDefault();
      handler.action();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
```

```tsx
// page.tsx 안
useEffect(() => {
  return attachShortcuts([
    { key: "1", action: () => setTab("home"), description: "홈" },
    { key: "2", action: () => setTab("explore"), description: "탐험" },
    { key: "3", action: () => setTab("coop"), description: "코옵" },
    { key: "4", action: () => setTab("arena"), description: "대련" },
    { key: "5", action: () => setTab("training"), description: "훈련장" },
    { key: "6", action: () => setTab("inventory"), description: "인벤토리" },
    { key: "7", action: () => setTab("codex"), description: "도감" },
    { key: "?", action: () => setHelpOpen(true), description: "도움말" },
    { key: "Escape", action: () => setHelpOpen(false), description: "닫기" },
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

도움말 모달에 단축키 목록 표시 추가.

### 작업량

**0.5일**

---

## 도입 우선순위

| 순위 | 항목               | 작업량 | 효과                     |
| ---- | ------------------ | ------ | ------------------------ |
| 1    | 장비 비교 툴팁     | 0.5일  | 큼 (장비 선택 효율 ↑)    |
| 2    | 도감 진척바        | 0.5일  | 중 (시각 만족)           |
| 3    | 키보드 단축키      | 0.5일  | 중 (파워유저 편의)       |
| 4    | 모바일 반응형 점검 | 1일    | 큼 (모바일 사용자)       |
| 5    | 업적 필터          | 1일    | 중                       |
| 6    | 첫 사용자 온보딩   | 1일    | 큼 (신규 유입 시 임팩트) |

총 **4.5일** (1인 기준).

추천 도입 순서:

1. **장비 비교 툴팁** + **도감 진척바** (반나절×2 = 1일)
2. **키보드 단축키** (반나절)
3. **모바일 반응형 점검** (1일)
4. **업적 필터** (1일)
5. **온보딩 보강** (1일) — 출시 직전 마무리

---

## 변경 파일 요약

| 파일                                         | 변경 종류                                                 |
| -------------------------------------------- | --------------------------------------------------------- |
| `src/components/EquipmentCompareTooltip.tsx` | 신규                                                      |
| `src/components/WelcomeModal.tsx`            | 신규                                                      |
| `src/lib/keyboard.ts`                        | 신규                                                      |
| `src/app/page.tsx`                           | 수정 (인벤토리 카드, 가이드 강조, 단축키 hook, 업적 필터) |
| `src/app/CodexPanel.tsx`                     | 수정 (진척바 추가)                                        |
| `src/app/BattleLogTurn.tsx`                  | 수정 (모바일 grid breakpoint)                             |
| `src/lib/game/types.ts`                      | 수정 (`welcomeShown` 플래그)                              |
| `src/lib/game/store.ts`                      | 수정 (`dismissWelcome` 액션, persist 마이그레이션)        |

페이지 비대화 회피: 업적 필터가 길어지면 별도 컴포넌트(`src/components/AchievementsPanel.tsx`)로 분리.

---

## 검증 체크리스트

### 장비 비교 툴팁

- [ ] hover 시 차이 표시
- [ ] 장착 중인 장비 hover 시 비교 X
- [ ] 같은 슬롯 장착품 없을 때 단순 보너스 표시
- [ ] 모바일 탭 동작 (Tooltip pinned 모드)

### 온보딩

- [ ] 첫 진입 시 환영 모달 1회만
- [ ] 스킵 후 재호출 가능 (헤더 버튼)
- [ ] persist에 `welcomeShown` 저장

### 모바일

- [ ] iPhone SE에서 모든 탭 정상 동작
- [ ] 전투 로그가 세로 스택으로 자동 변경
- [ ] 모달 가로 폭 적정

### 도감 진척바

- [ ] 메인 진척바 + 다음 포인트 미니 바
- [ ] 0% 100% 양 끝 정상 렌더링

### 업적 필터

- [ ] 카테고리 + 완료 상태 조합
- [ ] 빈 결과 안내
- [ ] 필터 상태 유지 (탭 이동 후 복귀)

### 키보드

- [ ] input 포커스 시 단축키 X
- [ ] Cmd/Ctrl 조합 시 비활성
- [ ] 도움말에 단축키 목록 표시
