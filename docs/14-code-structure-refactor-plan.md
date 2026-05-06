# 코드 구조 정리 — 리팩터 계획

> `page.tsx` 분할 + 공통 타입 정리 + 유사 패턴 통합. 동작 변경 없는 순수 구조 리팩터.

## 코드베이스 사전 점검

### 파일 사이즈 (큰 순)

| 파일                        | 줄 수     |
| --------------------------- | --------- |
| `src/app/page.tsx`          | **3,510** |
| `src/app/CoopBossPanel.tsx` | 474       |
| `src/app/TrainingPanel.tsx` | 304       |
| `src/app/CodexPanel.tsx`    | 259       |
| `src/app/ArenaPanel.tsx`    | 250       |

### `page.tsx` 내부 구조

3,510줄, 31개 함수 컴포넌트. 크게 4개 그룹:

| 그룹                              | 컴포넌트                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **메인 + 탭 (인라인)**            | `Home`, `tab === "home"`, `"explore"`, `"class"`, `"estate"`, `"monument"`, `"info"`, `"inventory"`, `"skills"`, `"stats"`, `"achievements"`, `"equipment_craft"`, `"items"` |
| **공통 UI primitives**            | `Panel`, `CollapsiblePanel`, `Tooltip`, `Row`, `ProgressBar`, `Stat`(in CodexPanel), `SettingsMenu`                                                                          |
| **게임 도메인 컴포넌트**          | `CharacterCard`, `HpBar`, `UpgradeRow`, `BossButton`, `TabButton`, `TutorialChecklist`, `DispatchLogStream`, `BossLogStream`                                                 |
| **토스트 / 모달 (page.tsx 내부)** | `AchievementToast`, `MilestoneToast`, `UniqueDropToast`, `OfflineSummaryModal`, `NamePromptModal`, `HelpContent`                                                             |

### 이미 분리된 탭

- `CoopBossPanel`, `ArenaPanel`, `TrainingPanel`, `CodexPanel`, `BattleLogViewer`, `BattleLogTurn`, `ChatWidget`

→ 새 분리는 이 패턴을 따름.

---

## 1. `page.tsx` 분할

### 1.1 목표 디렉터리 구조

```
src/
  app/
    page.tsx                 # 200~300줄 목표 (헤더·탭 라우팅·전역 hook)
    tabs/                    # ★ 신규 — 탭별 컴포넌트
      HomeTab.tsx
      ExploreTab.tsx
      ClassTab.tsx
      EstateTab.tsx
      MonumentTab.tsx
      InfoTab.tsx
      InventoryTab.tsx
      SkillsTab.tsx
      StatsTab.tsx
      AchievementsTab.tsx
      EquipmentCraftTab.tsx
      ItemsTab.tsx
      (CoopBossPanel/ArenaPanel/TrainingPanel/CodexPanel은 기존 위치 유지)
  components/
    ui/                      # ★ 신규 — 도메인 무관 공통 UI
      Panel.tsx
      CollapsiblePanel.tsx
      Tooltip.tsx
      Row.tsx
      ProgressBar.tsx
      ModalShell.tsx         # 모달 공통 컨테이너 (신규)
      ToastShell.tsx         # 토스트 공통 컨테이너 (신규)
    game/                    # ★ 신규 — 게임 도메인 컴포넌트
      CharacterCard.tsx
      HpBar.tsx
      UpgradeRow.tsx
      BossButton.tsx
      TabButton.tsx
      TutorialChecklist.tsx
      DispatchLogStream.tsx
      BossLogStream.tsx
    toasts/                  # ★ 신규
      AchievementToast.tsx
      MilestoneToast.tsx
      UniqueDropToast.tsx
    modals/                  # ★ 신규
      OfflineSummaryModal.tsx
      NamePromptModal.tsx
      WelcomeModal.tsx       # 이동
      FeedbackModal.tsx      # 이동
    SettingsMenu.tsx         # 단독
    FeedbackButton.tsx       # 기존
    EquipmentCompareTooltip.tsx  # 기존
```

### 1.2 단계별 분리 순서

작은 것부터 → 큰 것 순서로. 중간에 깨지지 않게.

| 단계     | 작업                                                                                                                                 | 작업량    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 1        | **공통 UI 분리** — `Panel`, `CollapsiblePanel`, `Tooltip`, `Row`, `ProgressBar`                                                      | 0.5일     |
| 2        | **모달/토스트 분리** — `*Toast`, `*Modal`, `HelpContent`                                                                             | 0.5일     |
| 3        | **게임 도메인 컴포넌트 분리** — `CharacterCard`, `HpBar`, `UpgradeRow`, `BossButton`, `TabButton`, `TutorialChecklist`, `*LogStream` | 1일       |
| 4        | **탭별 컴포넌트 분리** — 작은 탭부터 (`InfoTab`, `StatsTab` ...)                                                                     | 2일       |
| 5        | **`page.tsx` 정리** — 남은 것은 hook, 라우팅, 헤더만                                                                                 | 0.5일     |
| **합계** |                                                                                                                                      | **4.5일** |

### 1.3 탭 컴포넌트 props 패턴

각 탭은 보통 다음만 받음:

```tsx
type TabProps = {
  state: ReturnType<typeof useGame>;
  onJump?: (t: Tab) => void; // 탭 간 이동이 필요한 경우만
};
```

또는 직접 `useGame()` 호출 (하위 컴포넌트도 같은 store에 구독):

```tsx
export function HomeTab() {
  const state = useGame();
  // ...
}
```

후자가 props drilling 없이 깔끔. `Home` 컴포넌트에서는 단순히:

```tsx
{
  tab === "home" && <HomeTab />;
}
{
  tab === "explore" && <ExploreTab onJump={setTab} />;
}
```

탭 간 이동이 필요한 경우(`onJump`)만 prop 전달.

### 1.4 import alias 정리

분리 후 import path가 길어질 가능성:

```tsx
import { Panel } from "@/components/ui/Panel";
import { CharacterCard } from "@/components/game/CharacterCard";
```

이미 `@/*` alias가 `tsconfig.json`에 설정되어 있어 그대로 사용. 깊은 경로는 barrel export(`index.ts`) 고려 가능하지만 처음엔 직접 import 권장.

---

## 2. 공통 타입 정리

### 2.1 현황

- 컴포넌트 props 타입이 거의 모두 인라인 (`function X({ a, b }: { a: string; b: number })`)
- 크게 문제는 아니지만 일부 props는 자주 반복됨

### 2.2 정리 대상

| 패턴                                                          | 위치                                | 권장                                                 |
| ------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `state: ReturnType<typeof useGame>` 또는 `useGame.getState()` | 여러 컴포넌트                       | `useGame()` 직접 호출로 통일 → props 자체 제거       |
| `onJump: (t: Tab) => void`                                    | 가이드 / TabButton 등               | `Tab` 타입을 `src/lib/game/types.ts`로 옮기고 export |
| `LastBattle` / `BossDispatchResult` / `LogEntry`              | 이미 `src/lib/game/types.ts`에 있음 | 그대로                                               |
| 컴포넌트 고유 props                                           | 각자 인라인                         | 그대로 (분리는 타입 가독성 떨어트림)                 |

`Tab` 타입은 현재 `page.tsx` 내부 정의. 탭 컴포넌트 분리 시 export 필요 → `src/app/tabs/types.ts` 또는 `src/lib/ui-types.ts`로 이동.

### 2.3 작업량

**0.3일** (탭 분리와 같이 진행하면 자연스럽게 처리)

---

## 3. 유사 패턴 통합

### 3.1 모달 통합

현재 모달들 (`WelcomeModal`, `FeedbackModal`, `OfflineSummaryModal`, `NamePromptModal`):

- 모두 `fixed inset-0 bg-black/XX z-[N] flex items-center justify-center p-4` 컨테이너
- `bg-panel` 또는 `bg-panel-2` 카드 + `max-w-XX` + `border-line-2 rounded-lg`
- `onClick={onClose}` outer + `onClick={(e) => e.stopPropagation()}` inner
- 헤더: 제목 + ✕ 버튼

→ **`ModalShell` 공통 컴포넌트**로 통합.

```tsx
// src/components/ui/ModalShell.tsx
type Size = "sm" | "md" | "lg";
const SIZE_CLS: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function ModalShell({
  title,
  onClose,
  size = "md",
  children,
  zIndex = 100,
}: {
  title?: React.ReactNode;
  onClose: () => void;
  size?: Size;
  children: React.ReactNode;
  zIndex?: number;
}) {
  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center p-4 overflow-y-auto`}
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        className={`bg-panel-2 border border-line-2 rounded-lg w-full ${SIZE_CLS[size]} max-h-[85vh] overflow-y-auto shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-line-2">
            <span className="font-medium text-fg-strong">{title}</span>
            <button onClick={onClose} className="text-fg-muted hover:text-fg-strong text-sm">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
```

각 모달은 이 shell 안에 본문만 정의:

```tsx
// FeedbackModal.tsx (after refactor)
export default function FeedbackModal({ onClose }: Props) {
  return (
    <ModalShell title="의견 보내기" onClose={onClose} size="md">
      {/* 본문 */}
    </ModalShell>
  );
}
```

### 3.2 토스트 통합

현재 토스트들 (`AchievementToast`, `MilestoneToast`, `UniqueDropToast`):

- 공통: `fixed top-4 left-1/2 -translate-x-1/2 z-[N]`
- 자동 dismiss (5~7초 setTimeout)
- 색상별 그라데이션 배경

→ **`ToastShell` 공통 컴포넌트**:

```tsx
// src/components/ui/ToastShell.tsx
type Variant = "achievement" | "milestone" | "drop" | "info";

const VARIANT_CLS: Record<Variant, string> = {
  achievement: "bg-amber-900/95 border-amber-600",
  milestone: "bg-gradient-to-br from-emerald-900/95 to-amber-900/95 border-amber-500",
  drop: "bg-gradient-to-br from-orange-900/95 to-rose-900/95 border-orange-400",
  info: "bg-panel border-line-2",
};

export function ToastShell({
  variant = "info",
  icon,
  onDismiss,
  autoDismissMs = 5000,
  zIndex = 110,
  children,
}: {
  variant?: Variant;
  icon?: React.ReactNode;
  onDismiss: () => void;
  autoDismissMs?: number;
  zIndex?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, onDismiss]);
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 border-2 rounded-lg shadow-2xl px-5 py-4 max-w-md ${VARIANT_CLS[variant]}`}
      style={{ zIndex }}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="text-3xl">{icon}</span>}
        <div className="min-w-0 flex-1">{children}</div>
        <button onClick={onDismiss} className="text-fg-muted hover:text-fg text-sm">
          ✕
        </button>
      </div>
    </div>
  );
}
```

각 토스트는 컨텐츠만:

```tsx
<ToastShell variant="drop" icon="★" onDismiss={onDismiss} autoDismissMs={7000}>
  <div className="text-orange-300 text-xs ...">유니크 드랍!</div>
  <div className="text-orange-200 font-bold">{def.name}</div>
  ...
</ToastShell>
```

### 3.3 카드 통합

`Panel`이 이미 공통 컴포넌트로 사용 중 (page.tsx:2890). 그대로 분리 후 import 사용.

`CollapsiblePanel`도 같은 위치. 둘 다 `src/components/ui/`로 이동.

### 3.4 작업량

**1일** (ModalShell + ToastShell 도입 + 기존 모달/토스트 마이그레이션)

---

## 도입 순서 (전체)

| 순서     | 작업                                                                  | 작업량  |
| -------- | --------------------------------------------------------------------- | ------- |
| 1        | 공통 UI 분리 (Panel, Tooltip 등 → `src/components/ui/`)               | 0.5일   |
| 2        | ModalShell + ToastShell 신규 + 기존 모달/토스트 통합                  | 1일     |
| 3        | 게임 도메인 컴포넌트 분리 (CharacterCard 등 → `src/components/game/`) | 1일     |
| 4        | 탭 컴포넌트 분리 (`src/app/tabs/`) — 작은 탭부터                      | 2일     |
| 5        | `Tab` 타입 export, `page.tsx` 정리                                    | 0.5일   |
| **합계** |                                                                       | **5일** |

각 단계가 독립 PR. 단계 간 작업은 type check + eslint + 동작 확인.

---

## 위험 / 대응

| 위험                                             | 대응                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `useGame()` 여러 컴포넌트에서 호출 → 리렌더 폭증 | Zustand는 selector 사용 시 부분 구독. `useGame((s) => s.character)` 같이 좁히기 |
| Hook 위반 (조건부 useEffect 등)                  | 분리 시 컴포넌트 마운트 시점이 달라질 수 있음. eslint react-hooks 룰로 검출     |
| 모달 z-index 충돌                                | ModalShell에 `zIndex` prop 노출, 기존 `[100]`/`[150]`/`[200]` 보존              |
| 단계별 PR이 너무 커짐                            | 컴포넌트 그룹별로 분할 commit, push 자주                                        |
| import 경로 깨짐                                 | TypeScript가 컴파일 시점에 잡음                                                 |
| 분리 시 기능 회귀                                | 단계마다 `npm run dev`로 직접 클릭 테스트                                       |

---

## 변경 파일 요약 (예상)

```
신규 (~25개):
  src/app/tabs/HomeTab.tsx, ExploreTab.tsx, ClassTab.tsx, ...
  src/components/ui/Panel.tsx, Tooltip.tsx, ModalShell.tsx, ToastShell.tsx, ...
  src/components/game/CharacterCard.tsx, HpBar.tsx, ...
  src/components/toasts/AchievementToast.tsx, MilestoneToast.tsx, UniqueDropToast.tsx
  src/components/modals/OfflineSummaryModal.tsx, NamePromptModal.tsx
  src/components/modals/WelcomeModal.tsx (이동)
  src/components/modals/FeedbackModal.tsx (이동)

수정:
  src/app/page.tsx (3,510 → ~300줄)
  기존 컴포넌트들 (import 경로)

삭제 없음 (이동만).
```

---

## 검증 체크리스트

- [ ] 단계마다 `npx tsc --noEmit` 통과
- [ ] 단계마다 `npx eslint .` 통과
- [ ] 각 탭 클릭 → 정상 렌더 / 인터랙션
- [ ] 토스트 (업적, 마일스톤, 유니크 드랍) 정상 표시
- [ ] 모달 (피드백, 환영, 오프라인 요약, 이름) 정상 동작
- [ ] 키보드 단축키 1~7 / ? 정상 동작
- [ ] persist 데이터 마이그레이션 영향 없음
- [ ] 모바일 화면 깨지지 않음

---

## 추가 (후속 검토)

리팩터 완료 후 검토할 것:

- **Storybook** 도입 — UI primitives를 isolation에서 보고 디자인 통일 점검
- **컴포넌트 단위 테스트** — Vitest + React Testing Library
- **번들 사이즈 영향** — 페이지 분할이 First Load JS에 영향 주는지 확인
- **page.tsx의 useEffect 정리** — offline summary, tick interval 등 hooks도 별도 파일로 분리 가능 (`src/lib/hooks/`)

본 리팩터의 목적은 **유지보수성 향상**. 동작 변경 X, 추가 기능 X. 추후 모든 기능 추가의 기반이 되므로 가능하면 단독 작업으로 진행 권장.
