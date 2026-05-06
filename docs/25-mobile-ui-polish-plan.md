# 모바일 UI 폴리시 플랜

> 관련 코드: `src/app/page.tsx`, `src/components/game/*` (AppHeader · TabNavigation · TabContent · CharacterCard · LogStream), `src/app/tabs/*`, `src/components/ui/*` (Modal · Tooltip · ProgressBar · Panel · Row), `src/components/modals/*`, `src/components/ChatWidget.tsx`
>
> 상태: **제안** (미적용). 모바일 체감 문제만 좁게 다룸 — 기능 추가/리디자인은 본 문서 범위 밖.

## 1. 배경

데스크톱 기준 max-w-3xl 단일 컬럼 레이아웃은 큰 변경 없이 모바일에 매핑되지만, 누적된 잔손질 부족으로 **세로 모바일 화면에서 어색한 부분**이 다수 존재. 본 플랜은 신규 기능 없이 **현재 정체성과 흐름을 그대로 유지**하면서 모바일 한정 잔결만 정리.

비목표:

- 모바일 전용 레이아웃 신설 (예: 하단 탭바)
- 데스크톱 UX 변경
- 게임 메커니즘/밸런스 수정

## 2. 현재 상태 진단

### 2.1 레이아웃 / 컨테이너 (`page.tsx:146`)

```tsx
<main className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
```

- 정상. `px-4` 16px 가장자리 여백 → 320px 화면에서도 286px 컨텐츠 폭 확보.
- 단, **iOS safe area inset 미반영** (홈 인디케이터 영역 침범 가능)
- 토스트(`fixed top-4 left-1/2`)는 상단 노치/다이나믹 아일랜드와 겹칠 수 있음

### 2.2 TabNavigation (`TabNavigation.tsx`)

```tsx
<div className="flex gap-1 border-b border-line flex-wrap">
```

- 4개 그룹 드롭다운 + 단일 탭 → `flex-wrap` 으로 좁은 화면에서 **2~3줄로 흩뿌려짐**
- 드롭다운 메뉴가 터치 영역 외부 클릭 감지에 의존(`mousedown`) — **모바일 터치 이벤트(touchstart)** 에 응답 안 할 수 있음
- 활성 탭 시각 강조가 약해 **현재 위치 인식 어려움**
- 키보드 단축키 1~7은 모바일에서 의미 없음 — UI 힌트만 점유

### 2.3 모달 / 오버레이

- `BattleLogViewer`, `OfflineSummaryModal`, `NamePromptModal`, `ModalShell` — 데스크톱 기준 중앙 배치
- 모바일에서 **풀스크린 슬라이드업** 패턴이 더 자연스러움
- 모달 내 긴 컨텐츠(코덱스, 설정, 전투 로그)에서 **스크롤 영역 / 헤더 sticky** 처리 미비
- 닫기 버튼 위치 일관성 — 일부는 우상단, 일부는 하단

### 2.4 Tooltip — 터치 미지원

- `Tooltip.tsx`는 hover 기반
- 장비 비교(`EquipmentCompareTooltip`), 능력치 환산 표기(`InfoTab`) 등이 **모바일에서 정보 노출 불가**
- 캐릭터 시트의 ATK/DEF/STR/VIT 등 환산값이 마우스 hover에만 보임 → 모바일에선 사실상 숨겨짐

### 2.5 입력 / 폼

- 이름 입력 (`NamePromptModal`), 피드백 입력 — 입력 필드 폰트 크기가 16px 미만이면 **iOS Safari 자동 줌-인** 발생
- 가상 키보드 등장 시 `viewport-fit` / `safe-area-inset-bottom` 처리 부재
- 키보드 가림 영역 고려 안됨 — 입력 필드가 키보드 뒤로 사라질 수 있음

### 2.6 길어지는 숫자 / 라벨

- 후반 자원: `12,345,678,901 골드` 같은 큰 수
- `tabular-nums` 미적용으로 자릿수 변동 시 좌우 흔들림
- 일부 라벨은 한 줄 가정 — 좁은 셀에서 **줄바꿈 깨짐**
- 보스 카드의 HP 막대 옆 수치, 코옵 보스 보상 표 등

### 2.7 Battle Log (`LogStream`)

- CLAUDE.md / CHANGELOG 에 "전투 로그 좌/우 분할 → 모바일 세로 스택" 이미 적용
- 그러나 **로그 한 줄이 길면 가로 스크롤 / 줄바꿈 처리** 미정 — 한 항목당 가독성 점검 필요
- 자동 스크롤 동작이 모바일에서 어색할 수 있음 (사용자가 위로 스크롤한 상태에서 자동 스크롤 강제)

### 2.8 ChatWidget / FeedbackButton — 우하단 충돌

- 둘 다 `fixed bottom-?` 우하단 영역
- 모바일 가로 모드에서 **컨텐츠와 겹침**
- 시스템 제스처 영역(iOS 홈 바, Android 제스처) 침범 가능

### 2.9 터치 타겟 크기

- TabButton 등 일부 버튼이 패딩 작음 (Apple HIG 권장 44×44pt 미달 가능성)
- Row 컴포넌트의 클릭 영역이 텍스트 너비에만 한정될 수 있음
- 인벤토리 그리드(`grid-cols-2`)의 셀 — 좁은 화면에서 손가락으로 정확히 누르기 빠듯할 수 있음

### 2.10 스크롤 / 탭 전환 시 위치

- 탭 전환 시 스크롤 위치 초기화 안됨 — 깊게 스크롤한 상태에서 다른 탭으로 가면 그 탭의 스크롤도 유지될 가능성
- 일부 탭은 짧고 일부는 매우 길어 **혼동 유발**

## 3. 개선 항목 — 우선순위별

### P0 (필수 — 사용성 직결)

| #        | 항목                                       | 변경                                                                                                    | 코드                                                 |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **P0-1** | safe area inset 반영                       | `<main>`에 `pb-[env(safe-area-inset-bottom)]`, 토스트에 `top-[max(1rem,env(safe-area-inset-top))]`      | `page.tsx`, 토스트 위치                              |
| **P0-2** | 입력 필드 16px 폰트                        | 전역 `input { font-size: 16px }` (md+ 에선 14px 다시 허용) — iOS 자동 줌 차단                           | `globals.css`, 모달 입력                             |
| **P0-3** | Tooltip 터치 활성화                        | `Tooltip.tsx`에 `onClick` 토글 모드 추가 — 호버 + 탭 둘 다 지원                                         | `components/ui/Tooltip.tsx`, EquipmentCompareTooltip |
| **P0-4** | TabNavigation flex-wrap 개선               | 모바일에선 가로 스크롤(`overflow-x-auto`) + `whitespace-nowrap` 으로 한 줄 유지, 활성 탭 underline 강조 | `TabNavigation.tsx`                                  |
| **P0-5** | 드롭다운 외부 클릭 감지 — 터치 이벤트 추가 | `mousedown` → `pointerdown` 으로 통합                                                                   | `TabNavigation.tsx:59`                               |

### P1 (개선 — 누적 잔손질)

| #        | 항목                                      | 변경                                                                        | 코드                                      |
| -------- | ----------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| **P1-1** | 큰 숫자 `tabular-nums`                    | 자원/스탯/HP 표시에 `font-variant-numeric: tabular-nums` 적용               | `Row.tsx`, `CharacterCard.tsx`, 자원 패널 |
| **P1-2** | 모달 — 모바일 풀스크린 패턴               | `ModalShell` 에 모바일 전용 `inset-0 sm:inset-auto sm:max-w-md` 옵션 도입   | `ModalShell.tsx`                          |
| **P1-3** | 모달 헤더 sticky + 내부 스크롤 영역 분리  | 닫기 버튼 + 제목은 sticky, 본문만 스크롤                                    | `ModalShell.tsx`, `BattleLogViewer.tsx`   |
| **P1-4** | LogStream 한 줄 줄바꿈 / 가로 스크롤 정리 | 한 메시지 내 긴 강조(💗 흡수 12,345 같은 누적 표시)에서 `break-words` 적용  | `LogStream.tsx`                           |
| **P1-5** | ChatWidget / FeedbackButton 충돌          | 두 위젯 z-index/위치 조정 — 가로 모드에선 자동 축소 또는 오프셋             | `ChatWidget`, `FeedbackButton`            |
| **P1-6** | 터치 타겟 최소 44×44                      | TabButton/Row/인벤토리 셀 패딩 보강                                         | `TabButton.tsx`, `Row.tsx`                |
| **P1-7** | 자동 스크롤 — 사용자 의도 존중            | LogStream에 "사용자가 직접 위로 스크롤하면 자동 스크롤 일시 중단" 로직 추가 | `LogStream.tsx`                           |

### P2 (선택 — 가능하면)

| #        | 항목                           | 변경                                                                                       | 코드                      |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------- |
| **P2-1** | 탭 전환 시 스크롤 위치 초기화  | `tab` 변경 시 `window.scrollTo({top:0})` (또는 탭별 위치 기억)                             | `page.tsx`                |
| **P2-2** | 키보드 단축키 힌트 모바일 숨김 | `?` 도움말 모달 — 단축키 섹션을 `hidden sm:block`                                          | `HelpTab.tsx` 단축키 부분 |
| **P2-3** | 모바일 메타 viewport 점검      | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` | `app/layout.tsx`          |
| **P2-4** | iOS PWA 메타 태그 (선택)       | `apple-mobile-web-app-capable`, `theme-color`                                              | `app/layout.tsx`          |

## 4. 단계별 작업

### 4.1 1차 PR — P0 일괄

코드 변경 분량: **~150줄**

1. 전역 CSS — safe area + 입력 16px 가드
2. `Tooltip.tsx` — 탭 토글 모드 (controlled state, outside click 닫기)
3. `TabNavigation.tsx` — 가로 스크롤 + 활성 강조 + pointerdown
4. iOS Safari + Android Chrome + 데스크톱 셀프 테스트
5. CHANGELOG 기록

### 4.2 2차 PR — P1 누적 정리

코드 변경 분량: **~250줄**

1. `ModalShell.tsx` 풀스크린 옵션 + 헤더 sticky 패턴
2. `tabular-nums` 적용 (Row, CharacterCard, 자원/스탯 패널)
3. LogStream 가독성/자동스크롤 의도 존중
4. 터치 타겟 패딩 보강
5. ChatWidget/FeedbackButton 충돌 정리

### 4.3 3차 PR (선택) — P2

scroll restoration, viewport meta, PWA 메타 등 자잘한 정리. 시간 여유 있을 때.

## 5. 검증 체크리스트

각 PR 머지 전:

- [ ] iOS Safari (실기기 또는 시뮬레이터) — iPhone SE / iPhone 15 Pro
- [ ] Android Chrome — 360px 너비
- [ ] 가로 모드 (orientation landscape)
- [ ] 다크/라이트 테마 둘 다
- [ ] 입력 모달 (이름/피드백) 자동 줌 없음 확인
- [ ] 캐릭터 시트의 STR/VIT/AGI/MATK 환산값 — 모바일에서 탭으로 노출 확인
- [ ] 탭 전환 빠른 응답 — 드롭다운 닫힘 자연스러운지
- [ ] 토스트 / 모달이 시스템 UI 영역(노치, 홈 인디케이터)과 안 겹침
- [ ] 긴 자원 숫자 표시 시 좌우 흔들림 없음 (tabular-nums)
- [ ] 빌드 통과 + 타입 체크 통과

## 6. 비변경 항목 (참고)

- 데스크톱 max-w-3xl 단일 컬럼 구조 유지
- 탭 그룹 4개 (탐험/전투/캐릭터/기타) 구조 유지 — 하단 탭바 신설 X
- 게임 데이터 / 메커니즘 / 아이콘 / 컬러 팔레트 무변경
- chatlog 우측 분할은 데스크톱에선 그대로 — 모바일 세로 스택은 이미 적용

## 7. 결정 보류 항목

- [ ] Tooltip 탭 토글 시 — 다음 탭 시 자동 닫기 vs 명시적 닫기 (대량 정보 노출 시 어느쪽이 자연스러운지 실기기 확인 필요)
- [ ] LogStream 자동 스크롤 일시 중단 임계 — 위로 N픽셀 스크롤 시 vs N% 스크롤 시
- [ ] ChatWidget을 가로 모드에서 자동 축소할지, 사용자 토글로 둘지
- [ ] PWA 메타 태그 도입 여부 — 설치 가능 PWA로 갈지, 그냥 웹앱 유지할지
- [ ] 탭 전환 시 스크롤 위치 — 항상 top vs 탭별 기억

## 8. 예상 효과

| 항목             | 현재 체감                         | 적용 후                  |
| ---------------- | --------------------------------- | ------------------------ |
| 탭 네비 인식     | 줄바꿈 + 약한 강조 → "내가 어디?" | 한 줄 + 강한 강조 → 명확 |
| 능력치 환산 정보 | hover 전용 → 모바일 보이지 않음   | 탭 토글 → 정보 노출      |
| 입력 모달        | 포커스 시 자동 줌 인 → 어색       | 줌 없음, 자연스러움      |
| 큰 자원 숫자     | 자릿수 변동 시 흔들림             | 고정 폭 정렬             |
| 모달             | 데스크톱 그대로 → 모바일 답답     | 풀스크린 슬라이드업      |
| 시스템 UI 침범   | 노치/홈바와 겹침                  | safe area 보호           |

직업/메커니즘 변경 없는 **순수 잔손질 PR 시리즈**로, 1~2일 작업 분량 추정.
