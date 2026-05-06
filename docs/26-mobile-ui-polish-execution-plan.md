# 모바일 UI 폴리시 실행 계획 (3 PR)

> 본 문서는 `docs/25-mobile-ui-polish-plan.md` 의 우선순위 P0/P1/P2를 **3개의 실행 가능한 PR**로 분해한 작업 지시서.
>
> 상태: **PR 1·2·3 모두 적용 완료** (commits `e7f34f4` · `60f4e75` · `9612afa`).

## PR 1 — P0 (필수) · 사용성 직결

목표: 모바일에서 **숨겨진/접근 불가/오작동** 항목 해결.

| 항목                                     | 파일                                       | 작업                                                                                                                                |
| ---------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** safe area                       | `src/app/globals.css`, `src/app/page.tsx`  | `<main>` 하단 padding에 `env(safe-area-inset-bottom)`, 토스트 상단에 `env(safe-area-inset-top)`. viewport meta `viewport-fit=cover` |
| **P0-2** 입력 자동 줌 차단               | `src/app/globals.css`                      | `input, textarea, select { font-size: 16px; }` (sm: 미디어 쿼리에서 14px 복원)                                                      |
| **P0-3** Tooltip 터치 모드               | `src/components/ui/Tooltip.tsx`            | hover + 탭 토글 동시 지원. 외부 영역 탭 시 닫힘                                                                                     |
| **P0-4** TabNavigation 한 줄 가로 스크롤 | `src/components/game/TabNavigation.tsx`    | `flex-wrap` → `overflow-x-auto whitespace-nowrap`, 활성 탭 underline 강조                                                           |
| **P0-5** 드롭다운 터치 닫기              | `src/components/game/TabNavigation.tsx:59` | `mousedown` → `pointerdown`                                                                                                         |

### 검증 — 셀프 점검

- 빌드 + 타입 체크 통과
- 데스크톱 회귀 — Tooltip hover 동작 유지, TabNavigation 평소 모습 유지 (flex-wrap 안 됨 = 한 줄 스크롤이지만 데스크톱은 가로 폭 충분해 스크롤 발생 안 함)
- 다크/라이트 토글 OK

### 커밋 메시지

```
feat: 모바일 UI 폴리시 P0 — safe area · 입력 줌 · Tooltip 탭 · TabNav 가로
```

---

## PR 2 — P1 (개선) · 누적 잔손질

목표: 모바일 체감 품질 한 단계 끌어올림.

| 항목                           | 파일                                             | 작업                                                        |
| ------------------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| **P1-1** tabular-nums          | `globals.css` 또는 `Row.tsx`/`CharacterCard.tsx` | 큰 숫자 표시 셀에 `font-variant-numeric: tabular-nums`      |
| **P1-2** 모달 모바일 풀스크린  | `src/components/ui/ModalShell.tsx`               | `inset-0 sm:inset-auto sm:max-w-md` + 슬라이드업 애니메이션 |
| **P1-3** 모달 헤더 sticky      | `ModalShell.tsx`, `BattleLogViewer.tsx`          | 헤더 `sticky top-0`, 본문만 스크롤                          |
| **P1-4** LogStream break-words | `src/components/game/LogStream.tsx`              | 긴 메시지 줄바꿈                                            |
| **P1-5** 위젯 충돌 정리        | `ChatWidget`, `FeedbackButton`                   | bottom 위치 + z-index 분리, 가로 모드 자동 축소             |
| **P1-6** 터치 타겟 44px+       | `TabButton.tsx`, `Row.tsx`                       | 패딩 `min-h-[44px]` 보강                                    |
| **P1-7** 자동 스크롤 의도 존중 | `LogStream.tsx`                                  | 사용자가 위로 스크롤 시 자동 스크롤 일시 중단               |

### 검증

- iOS Safari + Android Chrome 실기기 (또는 dev tool 모바일 모드)
- 큰 숫자 자릿수 변동 시 흔들림 없음
- 풀스크린 모달 — 닫기 버튼 sticky로 항상 노출
- 가로 모드에서 ChatWidget 자동 축소 또는 위치 OK

### 커밋 메시지

```
feat: 모바일 UI 폴리시 P1 — 풀스크린 모달 · tabular-nums · 위젯 충돌 · 자동 스크롤
```

---

## PR 3 — P2 (선택) · 마무리

목표: 자잘한 정리.

| 항목                               | 파일                      | 작업                                                                        |
| ---------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| **P2-1** 탭 전환 시 스크롤 top     | `src/app/page.tsx`        | `useEffect(() => window.scrollTo(0,0), [tab])`                              |
| **P2-2** 키보드 단축키 모바일 숨김 | `HelpTab.tsx` 단축키 섹션 | `hidden sm:block`                                                           |
| **P2-3** viewport meta 점검        | `src/app/layout.tsx`      | `viewport-fit=cover` 명시 (PR1에서 이미 처리될 수도 있음 — 중복 시 P2 스킵) |
| **P2-4** PWA 메타 (선택)           | `app/layout.tsx`          | `apple-mobile-web-app-capable`, `theme-color`                               |

### 검증

- 탭 빠르게 전환 시 스크롤 자연스러움
- 모바일 도움말에 단축키 안 보임 (의미 없음)

### 커밋 메시지

```
feat: 모바일 UI 폴리시 P2 — scroll restoration · 단축키 모바일 숨김 · viewport
```

---

## 일정 추정

| PR        | 분량   | 추정 시간 |
| --------- | ------ | --------- |
| PR 1 (P0) | ~150줄 | 30~45분   |
| PR 2 (P1) | ~250줄 | 60~90분   |
| PR 3 (P2) | ~50줄  | 20분      |

총 ~2시간 작업. 본 PR 1부터 즉시 시작.

## 비변경 사항

- 데스크톱 레이아웃 유지
- 게임 메커니즘 / 스킬 / 데이터 무변경
- 컴포넌트 구조 신설 없음 — 기존 컴포넌트 보강만
