# 게임 시스템 문서

방치형 텍스트 RPG의 핵심 시스템을 정리한 문서입니다. 코드 변경에 따라 사실관계가 바뀔 수 있으니, 마지막 동기화 커밋을 기준으로 검토하세요.

## 인덱스

| 문서                                                                           | 다루는 내용                                                                         |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [01-character.md](./01-character.md)                                           | 직업(1차/2차), 스탯(주속성/2차속성), 레벨/경험치, HP·SPD 등 메커니즘                |
| [02-combat.md](./02-combat.md)                                                 | 전투 공식, 슬롯·공격 횟수, 크리/회피, DOT, 데미지 흐름                              |
| [03-skills.md](./03-skills.md)                                                 | 스킬 효과 종류, 트리거, 슬롯 소모 규칙, 학습 시스템                                 |
| [04-equipment.md](./04-equipment.md)                                           | 장비 슬롯·세트·제작·드랍·유니크 시스템                                              |
| [05-content.md](./05-content.md)                                               | 지역(필드)·필드 보스·협동 보스·대련                                                 |
| [06-progression.md](./06-progression.md)                                       | 기록의 서·명예의 전당·영지·업적                                                     |
| [07-technical.md](./07-technical.md)                                           | 영구 저장(persist)·마이그레이션·테마·아키텍처                                       |
| [08-balance-reference.md](./08-balance-reference.md)                           | **시뮬레이션·밸런스 체크용 빠른 참조** (보스 스탯, 공식, 상수, 시나리오 일괄)       |
| [09-monitoring.md](./09-monitoring.md)                                         | **운영/모니터링 시스템 설계** (Sentry·Vercel Analytics·피드백·메트릭스·관리자 콘솔) |
| [10-monitoring-implementation-plan.md](./10-monitoring-implementation-plan.md) | **09 시스템의 코드베이스 매핑·Phase별 구현 계획** (파일 변경, 작업량, 위험 회피)    |
| [11-ux-polish-plan.md](./11-ux-polish-plan.md)                                 | **UX 폴리싱 계획** (장비 비교/온보딩/모바일/도감 진척바/업적 필터/단축키)           |
| [12-release-prep-plan.md](./12-release-prep-plan.md)                           | **출시 준비 + README + 메트릭스 대시보드 계획** (에러 페이지·SEO·Phase 3)           |
| [13-dev-env-plan.md](./13-dev-env-plan.md)                                     | **개발 환경 정비 계획** (Prettier · Husky/lint-staged · VS Code 권장 설정)          |
| [14-code-structure-refactor-plan.md](./14-code-structure-refactor-plan.md)     | **코드 구조 리팩터 계획** (page.tsx 분할 · 공통 타입 · 모달/토스트 통합)            |

## 코드 진입점

- 데이터(밸런스 정의): `src/lib/game/data.ts`
- 타입 정의: `src/lib/game/types.ts`
- 전투/스킬 시뮬레이터: `src/lib/game/logic.ts`
- 상태 저장소(Zustand + persist): `src/lib/game/store.ts`
- 메인 화면: `src/app/page.tsx`
- 전투 로그 컴포넌트: `src/app/BattleLogTurn.tsx`, `src/app/BattleLogViewer.tsx`

## 캐시 / 작업 효율 팁

밸런스 시뮬레이션이나 데미지 검증은 **08-balance-reference.md만** 읽어도 대부분 해결됩니다.
이 한 파일에 보스 스탯·공식·상수·시나리오를 모아두어, 같은 데이터를 위해 `data.ts`를
여러 번 grep할 필요가 없습니다 (같은 컨텍스트에서 반복 시 prompt cache 히트).

> 코드를 바꾸면 08을 함께 갱신해야 다음 시뮬레이션이 정확합니다.

## 마지막 동기화

이 문서는 `main` 브랜치 기준으로 작성되었습니다. 코드와 동기화 시점은 각 문서 상단에 명시되어 있습니다.
