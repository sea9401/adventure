# 방치형 RPG

텍스트 기반의 한국어 방치형 웹 RPG.
직업을 정해 탐험·보스 도전을 보내고, 영구 누적 진행 시스템(영지·기록의 서·명예의 전당)으로 천천히 강해집니다.

> Next.js 16 / React 19 / TypeScript / Tailwind v4 / Zustand / Vercel KV.
> 상세 시스템은 [`docs/`](./docs/README.md) 참고.

## 빠른 시작

요구 사항: **Node 20.9+**, npm.

```bash
git clone <this-repo>
cd <repo>
npm install
cp .env.example .env.local   # 필요한 변수만 채워도 동작
npm run dev
# http://localhost:3000
```

## 환경 변수

모두 **선택 사항** — 미설정 시 해당 기능만 비활성(graceful fallback). 자세한 의미는 [`.env.example`](./.env.example) 참고.

| 변수                                    | 영향                                                           |
| --------------------------------------- | -------------------------------------------------------------- |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | 코옵·대련·채팅·피드백·메트릭스 서버 기능 활성화                |
| `ANTHROPIC_API_KEY`                     | 보스 처치 보고서 AI 내레이션 (없으면 mock 텍스트)              |
| `ADMIN_KEY`                             | `/admin` 페이지 / 관리자 API 접근                              |
| `NEXT_PUBLIC_TEST_MODE`                 | `1`이면 테스트값(50× 보상, 1분 보스 쿨), prod 미설정 시 정상값 |
| `NEXT_PUBLIC_FEEDBACK_ENABLED`          | `1`이면 우하단 💬 피드백 버튼 노출                             |
| `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_*`) | Sentry 에러 모니터링                                           |
| `IP_SALT`                               | 피드백 IP 해시 솔트 (운영 강한 무작위 권장)                    |

## 문서

[`docs/`](./docs/) 폴더 — 시스템·밸런스·운영·계획서가 12개 markdown으로 정리되어 있습니다.

| 주요 문서                                                        | 내용                        |
| ---------------------------------------------------------------- | --------------------------- |
| [`docs/README.md`](./docs/README.md)                             | 인덱스                      |
| [`docs/02-combat.md`](./docs/02-combat.md)                       | 전투 공식                   |
| [`docs/04-equipment.md`](./docs/04-equipment.md)                 | 장비 / 유니크 드랍          |
| [`docs/08-balance-reference.md`](./docs/08-balance-reference.md) | 시뮬레이션·밸런스 빠른 참조 |
| [`docs/09-monitoring.md`](./docs/09-monitoring.md)               | 운영/모니터링 시스템 설계   |

## 명령어

```bash
npm run dev      # 개발 서버 (Turbopack)
npm run build    # 프로덕션 빌드
npm run start    # 빌드 결과 실행
npm run lint     # ESLint
```

## 배포

Vercel 권장. 저장소 연결 후 환경변수 설정 → `main` 브랜치 push 시 자동 배포.

- Node 20.9+ 런타임 사용
- KV / Sentry / Admin 변수는 Vercel 프로젝트 설정에 직접 입력 (`.env.local`은 커밋 X)

## 디렉터리 구조 (요약)

```
src/
  app/                 # Next.js App Router (페이지·API)
    api/               # 서버 라우트 (coop, arena, report, feedback, stats 등)
    admin/             # 관리자 콘솔 (ADMIN_KEY 인증)
    page.tsx           # 메인 게임 화면
  components/          # 재사용 UI (FeedbackButton, WelcomeModal 등)
  lib/
    game/              # 게임 로직 / 상태 / 데이터
      data.ts          # 모든 밸런스 / 정의 (CLASSES, REGIONS, EQUIPMENT...)
      logic.ts         # 전투 시뮬레이터, 데미지 공식
      store.ts         # Zustand store + persist
      types.ts         # 타입 정의
    rate-limit.ts      # API rate-limiter
    metrics.ts         # 게임 메트릭스 KV 헬퍼
    feedback.ts        # 피드백 클라이언트 헬퍼
    keyboard.ts        # 글로벌 키보드 단축키
docs/                  # 시스템·계획 문서
```

## 라이선스

(설정되지 않음 — 비공개 저장소)
