# 운영 / 모니터링 시스템 설계

> 본 문서는 **설계 / 도입 가이드**. 구현 전 단계.
> 목표: 운영 시 발생하는 문제를 빠르게 발견하고, 사용자 피드백을 수집하며, 게임 메트릭스를 추적할 수 있는 시스템 구축.

## 목차

1. [전체 개요](#전체-개요)
2. [사용자 피드백 시스템](#1-사용자-피드백-시스템)
3. [에러 모니터링 (Sentry)](#2-에러-모니터링-sentry)
4. [Vercel Analytics](#3-vercel-analytics)
5. [게임 메트릭스](#4-게임-메트릭스)
6. [관리자 대시보드 확장](#5-관리자-대시보드-확장)
7. [알림 / 알람](#6-알림--알람)
8. [도입 우선순위](#도입-우선순위)
9. [비용 / 라이선스](#비용--라이선스)
10. [보안 / 프라이버시](#보안--프라이버시)

---

## 전체 개요

### 목표

| 영역      | 질문                                   | 도구                         |
| --------- | -------------------------------------- | ---------------------------- |
| 에러      | "지금 무엇이 깨지고 있는가?"           | Sentry                       |
| 사용성    | "어디서 막히는가? 무엇을 원하는가?"    | 피드백 폼 + Vercel Analytics |
| 게임 건강 | "DAU / 분포 / 진척도가 어떤가?"        | 게임 메트릭스 API            |
| 인프라    | "API가 정상인가? Rate Limit 적정한가?" | Vercel 대시보드 + KV 카운터  |

### 데이터 흐름 요약

```
클라이언트
   ├─ 에러 발생 → Sentry SDK → Sentry 대시보드
   ├─ 페이지뷰/Web Vitals → Vercel Analytics
   ├─ 사용자 피드백 → POST /api/feedback → KV
   └─ 게임 액션 → 통계 카운터 (KV INCR)
                                    ↓
                           GET /api/stats/global → 관리자 패널
```

### 환경 변수 요약

```bash
# 기존
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
ANTHROPIC_API_KEY=...
ADMIN_KEY=...
NEXT_PUBLIC_TEST_MODE=0|1

# 신규 (이 문서 도입 시)
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...        # source map 업로드 (optional)
NEXT_PUBLIC_VERCEL_ANALYTICS=1   # 명시 활성 (Vercel은 자동 인식이지만 안전망)
NEXT_PUBLIC_FEEDBACK_ENABLED=1   # 피드백 폼 노출 토글
```

---

## 1. 사용자 피드백 시스템

### 목표

플레이어가 버그·제안·일반 의견을 게임 안에서 1~2클릭으로 보낼 수 있도록.

### UI 디자인

**진입점**: 화면 우하단 floating 버튼 (💬). `NEXT_PUBLIC_FEEDBACK_ENABLED=1`이면 노출.

클릭 시 모달:

```
┌───────────────────────────────────┐
│  의견 보내기                    ✕  │
├───────────────────────────────────┤
│  종류:  [○ 버그] [○ 제안] [○ 기타] │
│  내용:                            │
│  ┌─────────────────────────────┐  │
│  │                             │  │
│  │                             │  │
│  └─────────────────────────────┘  │
│  연락처(선택): [           ]      │
│                                   │
│           [취소]  [보내기]        │
└───────────────────────────────────┘
```

전송 시 자동 첨부:

- 캐릭터 이름, 레벨, 직업
- 현재 탭 / 마지막 액션
- 게임 버전 (data.ts나 package.json에서)
- User Agent

### 데이터 모델

KV 구조:

```ts
type FeedbackEntry = {
  id: string; // ULID
  at: number; // epoch ms
  type: "bug" | "suggestion" | "general";
  text: string; // 최대 1000자
  contact?: string; // 최대 100자
  context: {
    nickname?: string;
    level?: number;
    className?: string;
    tab?: string;
    version?: string;
    userAgent?: string;
  };
  ip: string; // hashed (개인정보 회피)
  status: "new" | "read" | "resolved" | "dismissed";
};
```

키:

- `feedback:list` — ID 배열 (최근 순)
- `feedback:item:{id}` — 개별 entry

### API 설계

```
POST /api/feedback
  Body: { type, text, contact?, context }
  Response: { ok: true, id }
  Rate limit: 3/분 (IP 기준), 본문 길이 검증

GET /api/feedback (admin only)
  Query: ?status=new&limit=50&cursor=...
  Headers: { x-admin-key }
  Response: { items: FeedbackEntry[], nextCursor }

PATCH /api/feedback (admin only)
  Body: { id, status }
  Response: { ok: true }
```

### 구현 파일

```
src/app/api/feedback/route.ts          # API 핸들러
src/components/FeedbackButton.tsx      # 우하단 floating 버튼
src/components/FeedbackModal.tsx       # 입력 모달
src/lib/feedback.ts                    # 클라이언트 전송 헬퍼
```

### 관리자 화면

기존 `/admin` 페이지에 탭 추가:

- **피드백** 탭 → 신규/읽음/해결 필터, 인라인으로 status 변경

---

## 2. 에러 모니터링 (Sentry)

### 목표

운영 중 발생하는 클라이언트 / 서버 에러를 실시간 수집, 알림.

### 도입 단계

**Step 1: 패키지 설치**

```bash
npm install @sentry/nextjs
```

자동 마법사:

```bash
npx @sentry/wizard@latest -i nextjs
```

생성되는 파일:

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `next.config.ts` 변경 (withSentryConfig wrap)

**Step 2: 핵심 설정**

```ts
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% 트레이스
  replaysOnErrorSampleRate: 1.0, // 에러 시 100% 세션 리플레이
  replaysSessionSampleRate: 0.0, // 일반 세션은 X (비용 절감)
  // 개인정보 마스킹
  beforeSend(event) {
    // 캐릭터 이름 같은 사용자 입력 마스킹
    if (event.request?.cookies) delete event.request.cookies;
    return event;
  },
});
```

**Step 3: 명시적 캡처**

API 라우트:

```ts
import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  try {
    // ...
  } catch (err) {
    Sentry.captureException(err, { extra: { route: "/api/coop" } });
    return Response.json({ error: "..." }, { status: 500 });
  }
}
```

게임 로직 critical path:

```ts
// store.ts에서 finalizeDispatch 등
try {
  // ...
} catch (err) {
  Sentry.captureException(err, { tags: { area: "combat" } });
  throw err;
}
```

### 알림 설정 (Sentry 대시보드)

- **신규 이슈** → Slack/Email
- **이슈 빈도 급증** (1시간 이내 100회 이상) → 즉시 알림
- **새 릴리스 후 24시간** → 회귀 모니터링

### 구현 파일

```
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
next.config.ts (수정)
src/lib/observability.ts  # captureException 래퍼 (선택)
```

---

## 3. Vercel Analytics

### 목표

페이지뷰·체류·Web Vitals 자동 수집. 비용 0 (Hobby plan 한도 내).

### 도입

```bash
npm install @vercel/analytics
```

```tsx
// src/app/layout.tsx
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 커스텀 이벤트 (선택)

```ts
import { track } from "@vercel/analytics";

// 보스 처치 시
track("boss_killed", { bossName, turns, damage });

// 2차 전직 시
track("class_advanced", { from, to, level });

// 유니크 드랍
track("unique_drop", { item, boss });
```

### 보고 항목

Vercel 대시보드에서 자동:

- 페이지뷰
- 방문자 수 (uniques)
- 국가별 분포
- Web Vitals (LCP, FID, CLS)
- 디바이스 / 브라우저
- Custom events (도입 시)

---

## 4. 게임 메트릭스

### 목표

실시간 게임 건강 상태를 수집. 직업/지역 인기도, DAU, 보스별 처치 횟수 등.

### 데이터 모델

KV 카운터 + 시계열:

```ts
// 일별 집계 (TTL 90일)
type DayStats = {
  day: string; // YYYY-MM-DD
  uniques: string[]; // 활성 닉네임 (Set)
  newPlayers: number; // 그 날 첫 등록한 닉네임 수
  bossKills: Record<string, number>;
  classDistribution: Record<string, number>; // 활성 닉네임의 마지막 클래스
};

// 글로벌 누적 (영구)
type GlobalStats = {
  totalPlayers: number; // 전체 등록 닉네임 수
  totalBossKills: Record<string, number>;
  totalSessions: number;
};
```

KV 키:

```
stats:day:{YYYY-MM-DD}     # JSON, TTL 90일
stats:day:{YYYY-MM-DD}:active  # SADD, TTL 90일 (중복 카운트 방지)
stats:global               # JSON, 영구
stats:global:lock          # mutex (동시성)
```

### 수집 지점

| 액션                      | 메트릭스 업데이트                                               |
| ------------------------- | --------------------------------------------------------------- |
| 닉네임 첫 등록 (arena 등) | `stats:global.totalPlayers++`, `stats:day:{today}.newPlayers++` |
| 활동 발생 (모든 API 호출) | `stats:day:{today}:active SADD nickname`                        |
| 보스 처치                 | `stats:day:{today}.bossKills[boss]++`, global도                 |
| 직업 변경                 | day의 classDistribution 갱신                                    |

### API 설계

```
GET /api/stats/global  (public, 캐시 1시간)
  Response: {
    totalPlayers,
    activeNow: number,         // 5분 내 active
    dau: number,               // today active count
    topBossKills: [{ boss, count }, ...],
    classDistribution: { warrior: 30%, rogue: 25%, ... }
  }

GET /api/stats/timeseries (admin only)
  Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&metric=dau|kills|new_players
  Response: { points: [{ day, value }, ...] }
```

### 클라이언트 표시 (선택)

홈 화면 통계 탭 / 푸터에 노출:

- "지금 활동 중: {activeNow}명"
- "오늘 신규 모험가: {newPlayers}"
- "이번 주 가장 많이 처치된 보스: {topBoss}"

### 구현 파일

```
src/lib/metrics.ts                # 카운터 헬퍼 (incrementDay, addActive 등)
src/app/api/stats/global/route.ts
src/app/api/stats/timeseries/route.ts
src/components/GlobalStats.tsx    # 클라이언트 표시 (선택)
```

기존 API에 metrics 호출 추가:

- `/api/coop`: 보스 처치 시 `incrementBossKill()`
- `/api/arena`: 등록 시 `addNewPlayer()`, `addActive()`
- 모든 API: `addActive(nickname)` (활동 기록)

---

## 5. 관리자 대시보드 확장

### 목표

기존 `/admin` 페이지를 운영 콘솔로 확장.

### 기존 → 확장

```
기존: EXP grant
신규 탭:
  ├─ 피드백 (목록 + 상태 변경)
  ├─ 메트릭스 (대시보드 카드 + 시계열 그래프)
  ├─ 활성 보스 (코옵 세션 관리)
  ├─ 시스템 (KV 사용량, rate limit 카운터, env 점검)
  └─ EXP grant (기존)
```

### 페이지 설계

```
/admin
  ├─ /admin/feedback       # 피드백
  ├─ /admin/metrics        # 메트릭스 대시보드
  ├─ /admin/coop           # 코옵 관리
  └─ /admin/system         # 시스템 점검
```

전부 ADMIN_KEY 인증 (이미 있는 패턴).

### 메트릭스 페이지 구성

```
┌─ KPI 카드 ────────────────────────────┐
│  전체  │  DAU  │  신규  │  활성    │
│  1,234 │  87   │  +5    │  12      │
└──────────────────────────────────────┘

┌─ DAU 추이 (30일) ─────────────────────┐
│  ███████████████████████████          │
└──────────────────────────────────────┘

┌─ 직업 분포 ─────────┐  ┌─ Top 보스 처치 ──┐
│  전사  35%          │  │  슬라임 왕 4500   │
│  도적  28%          │  │  늑대 우두머리 3200│
│  마법사 37%         │  │  ...               │
└────────────────────┘  └────────────────────┘
```

---

## 6. 알림 / 알람

### Webhook 통합

KV에 `admin:webhook_url` 키 저장 (Slack incoming webhook URL 등).

알림 대상:

- 신규 피드백 도착
- Sentry critical issue (Sentry → Slack 직접도 가능)
- API rate limit 임계 초과 (분당 100건 이상 429)
- KV 사용량 한도 임박

### 구현 위치

```ts
// src/lib/alert.ts
export async function notifyAdmin(message: string, context?: object) {
  const webhook = await kv.get<string>("admin:webhook_url");
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        attachments: [{ color: "danger", text: JSON.stringify(context, null, 2) }],
      }),
    });
  } catch {
    /* 실패해도 본 흐름 영향 X */
  }
}
```

`/api/feedback`에서 신규 도착 시 호출:

```ts
notifyAdmin(`📩 신규 피드백 (${entry.type}): ${entry.text.slice(0, 80)}`);
```

---

## 도입 우선순위

| 단계                        | 항목                                  | 작업량 | 효과    |
| --------------------------- | ------------------------------------- | ------ | ------- |
| **Phase 1** (출시 전 필수)  | Sentry 도입 + 사용자 피드백 폼        | 중     | 매우 큼 |
| **Phase 2** (출시 직후 1주) | Vercel Analytics + 게임 메트릭스 기본 | 소     | 큼      |
| **Phase 3** (운영 안정화)   | 관리자 대시보드 확장 + 시계열 차트    | 대     | 중      |
| **Phase 4** (필요 시)       | Webhook 알림 + 정밀 모니터링          | 중     | 중      |

---

## 비용 / 라이선스

| 도구             | 무료 한도                           | 비고                     |
| ---------------- | ----------------------------------- | ------------------------ |
| Sentry           | 5k errors/month, 10k transactions   | 충분                     |
| Vercel Analytics | Hobby: 2.5k events/month, Pro: 100k | 작은 게임은 무료 한도 OK |
| Vercel KV        | 30k commands/day, 256MB             | 메트릭스 카운터는 가벼움 |
| Anthropic API    | 사용량 기반 과금                    | rate-limit으로 비용 통제 |

---

## 보안 / 프라이버시

### 수집하지 말 것

- 비밀번호 / 토큰
- 정확한 IP (해시만)
- 캐릭터 채팅 / 메시지 (선택적)

### 마스킹

```ts
// IP 해시
import { createHash } from "crypto";
const hashIp = (ip: string) =>
  createHash("sha256")
    .update(ip + (process.env.IP_SALT ?? ""))
    .digest("hex")
    .slice(0, 16);
```

### Sentry beforeSend 훅

이미 위 설정에 포함. URL 쿼리 / 쿠키에 PII 가능성 있는 값 제거.

### 사용자 동의

`/admin` 외 페이지에서 분석 도구 활성 시 footer에 "익명 분석 데이터 수집 중" 한 줄 표시.

GDPR 대상 지역 운영 시 opt-out 토글 필요 — `NEXT_PUBLIC_TRACKING_DEFAULT=on|off`로 분기.

---

## 구현 체크리스트

### Phase 1 (출시 전)

- [ ] `npm install @sentry/nextjs` + `npx @sentry/wizard`
- [ ] `NEXT_PUBLIC_SENTRY_DSN` 환경변수 추가
- [ ] `sentry.client/server/edge.config.ts` 설정 (PII 필터)
- [ ] API 라우트 critical path에 `Sentry.captureException`
- [ ] `src/components/FeedbackButton.tsx` + `FeedbackModal.tsx` 구현
- [ ] `/api/feedback` 라우트 (POST + GET admin)
- [ ] 관리자 페이지에 피드백 탭 추가
- [ ] `notifyAdmin()` 헬퍼 + 신규 피드백 시 Slack 통보 (optional)

### Phase 2

- [ ] `npm install @vercel/analytics` + `<Analytics />` 추가
- [ ] `src/lib/metrics.ts` 구현 (incrementDay, addActive, addBossKill)
- [ ] 기존 API에 metrics 호출 삽입
- [ ] `/api/stats/global` 라우트 (캐시 1h)

### Phase 3

- [ ] `/api/stats/timeseries` 라우트
- [ ] 관리자 메트릭스 페이지 (KPI 카드 + 차트)
- [ ] 직업 분포 / Top 보스 표시
- [ ] (선택) 클라이언트 푸터에 "지금 활동 중: N명"

### Phase 4

- [ ] Webhook URL 설정 UI
- [ ] Rate limit 임계 알림
- [ ] KV 사용량 모니터 (limits 임박 시 경고)

---

## 참고

- Sentry Next.js: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Vercel Analytics: https://vercel.com/docs/analytics
- Vercel KV: https://vercel.com/docs/storage/vercel-kv

---

본 문서는 **설계**입니다. 실제 구현은 Phase 단위로 별도 PR로 진행 권장. 각 Phase가 끝나면 이 문서의 체크리스트를 갱신하고, 도입된 시스템의 운영 가이드는 별도 문서(`docs/operations.md`)로 분리할 것.
