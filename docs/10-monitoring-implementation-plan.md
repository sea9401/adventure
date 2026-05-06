# 운영/모니터링 구현 계획

> 09-monitoring.md(설계)를 현재 코드베이스에 적용하기 위한 단계별 작업 계획.
> 각 항목에 변경할 파일·삽입 위치·예상 작업량을 기재.

## 코드베이스 사전 점검 결과

### 이미 존재하는 자산 ✅

| 자산                               | 위치                                        | 활용                                |
| ---------------------------------- | ------------------------------------------- | ----------------------------------- |
| `/admin` 페이지 + `ADMIN_KEY` 인증 | `src/app/admin/page.tsx`, `AdminClient.tsx` | 신규 운영 화면을 동일 패턴으로 추가 |
| KV (Vercel) 통합                   | `@vercel/kv`, `hasKv()` 가드                | 피드백·메트릭스 저장소로 재사용     |
| Rate limiter                       | `src/lib/rate-limit.ts`                     | 신규 API에 즉시 적용 가능           |
| Anthropic SDK                      | `@anthropic-ai/sdk`                         | (변경 없음)                         |
| 토스트 패턴                        | store의 `_xxxToast` + `page.tsx` 렌더       | 피드백 전송 성공 알림 등에 재사용   |
| 닉네임 추적 (부분)                 | `arena.ts`의 nickname-indexed 풀            | DAU/유니크 카운트의 시드로 활용     |

### 부재 / 신규 도입 필요 ❌

| 항목                                 | 비고                                     |
| ------------------------------------ | ---------------------------------------- |
| Sentry SDK                           | `@sentry/nextjs` 미설치                  |
| Vercel Analytics SDK                 | `@vercel/analytics` 미설치               |
| 글로벌 layout에 분석 / 에러 SDK 슬롯 | `src/app/layout.tsx`가 비어 있음         |
| `next.config.ts`에 Sentry wrap       | 현재 빈 config                           |
| 활동 추적 카운터                     | 모든 닉네임 활동을 모으는 단일 지점 없음 |
| 피드백 저장소 / API / UI             | 전부 신규                                |
| 중앙화된 logger 헬퍼                 | `console.error/warn` 호출조차 없음       |

### 주의 사항

- **next.config.ts 수정 시**: `withSentryConfig` wrap이 빌드 영향. 별도 PR 권장.
- **layout.tsx 수정 시**: `<Analytics />`, `<SpeedInsights />` 같은 외부 컴포넌트는 `bg-canvas` 컨테이너 밖에 둘 것 (스타일 영향 X).
- **AdminClient.tsx**: 단일 컴포넌트가 비대 — Phase 3에서 탭으로 분할하며 정리 필요.
- **rate-limit.ts**: 이미 도입돼 있으니, 신규 API는 import해서 즉시 적용.
- **GDPR / 동의**: 현재 안내 문구 없음. Sentry 도입 시 footer 한 줄 권장.

---

## Phase 1 — 출시 차단 항목 (필수)

### 1.1 Sentry 도입 (0.5 ~ 1일)

**의존성**

```bash
npm install @sentry/nextjs
```

**환경 변수** (`.env.local` / Vercel)

```
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...        # source map 업로드용 (선택)
SENTRY_ORG=...
SENTRY_PROJECT=...
```

**수동 설정 권장** (마법사보다 변경 명확):

1. `sentry.client.config.ts` (신규)
2. `sentry.server.config.ts` (신규)
3. `sentry.edge.config.ts` (신규) — 현재는 거의 모든 라우트가 `runtime = "nodejs"`라서 빈 init만
4. `next.config.ts` 수정:
   ```ts
   import { withSentryConfig } from "@sentry/nextjs";
   const nextConfig: NextConfig = {
     /* ... */
   };
   export default withSentryConfig(nextConfig, {
     silent: true,
     org: process.env.SENTRY_ORG,
     project: process.env.SENTRY_PROJECT,
     widenClientFileUpload: true,
     hideSourceMaps: true,
     disableLogger: true,
   });
   ```

**핵심 캡처 지점** (수동 try/catch + Sentry.captureException)

| 파일                          | 메서드                                        | 이유                |
| ----------------------------- | --------------------------------------------- | ------------------- |
| `src/app/api/coop/route.ts`   | POST 핸들러 catch                             | 코옵 보스 처리 실패 |
| `src/app/api/report/route.ts` | POST 핸들러 catch                             | Anthropic 호출 실패 |
| `src/app/api/arena/route.ts`  | POST 핸들러 catch                             | 등록/조회 실패      |
| `src/lib/game/store.ts`       | `finalizeDispatch`, `coopAttack`, `coopClaim` | 게임 로직 critical  |

> **게임 로직 캡처 시 주의**: 클라이언트에서 호출되므로 Sentry가 자동 캡처. 단, store action에서 try/catch로 감싸지 않은 부분이 많음 → 일부러 캐치하지 말고 unhandled로 두면 자동 보고.

**privacy / PII 필터** (`sentry.client.config.ts`):

```ts
beforeSend(event, hint) {
  // localStorage의 character.name이 user input이라 마스킹
  if (event.user?.username) event.user.username = "[masked]";
  if (event.request?.cookies) delete event.request.cookies;
  return event;
}
```

**검증**

- [ ] `npm run dev`로 실행, 에러 일부러 발생 → Sentry 대시보드에 도착 확인
- [ ] `npm run build` 통과
- [ ] DSN 미설정 시 SDK가 noop인지 확인

---

### 1.2 사용자 피드백 폼 (1 ~ 1.5일)

**파일 변경**

| 위치                                | 종류 | 내용                                         |
| ----------------------------------- | ---- | -------------------------------------------- |
| `src/lib/feedback.ts`               | 신규 | 클라이언트 전송 헬퍼 (`sendFeedback`)        |
| `src/components/FeedbackButton.tsx` | 신규 | 우하단 floating 버튼                         |
| `src/components/FeedbackModal.tsx`  | 신규 | 입력 모달                                    |
| `src/app/api/feedback/route.ts`     | 신규 | POST(공개) + GET/PATCH(admin)                |
| `src/app/page.tsx`                  | 수정 | `<FeedbackButton />` 마운트 (다른 토스트 옆) |
| `src/app/admin/AdminClient.tsx`     | 수정 | "피드백" 탭/섹션 추가                        |
| `docs/09-monitoring.md`             | 수정 | 체크리스트 갱신                              |

**API 라우트 설계** (`/api/feedback/route.ts`)

```ts
import { kv } from "@vercel/kv";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";

const LIST_KEY = "feedback:list"; // 최근 ID 1000개 (LPUSH/LRANGE)
const ITEM_KEY = (id: string) => `feedback:item:${id}`;
const MAX_TEXT = 1000;
const MAX_CONTACT = 100;

export async function POST(req: Request) {
  if (!hasKv()) return Response.json({ error: "disabled" }, { status: 503 });
  const ip = getClientIp(req);
  const rl = await rateLimit(`fb:${ip}`, 3, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const body = (await req.json()) as Partial<FeedbackEntry>;
  // sanitize + validate
  // ...
  const entry: FeedbackEntry = {
    id: ulid(),
    at: Date.now(),
    type: body.type === "bug" || body.type === "suggestion" ? body.type : "general",
    text: (body.text ?? "").slice(0, MAX_TEXT),
    contact: body.contact?.slice(0, MAX_CONTACT),
    context: { ...body.context }, // already small
    ip: hashIp(ip),
    status: "new",
  };
  await kv.set(ITEM_KEY(entry.id), entry);
  await kv.lpush(LIST_KEY, entry.id);
  await kv.ltrim(LIST_KEY, 0, 999);
  return Response.json({ ok: true, id: entry.id });
}

export async function GET(req: Request) {
  // x-admin-key 헤더 검증
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  const ids = await kv.lrange<string>(LIST_KEY, 0, limit - 1);
  const items = await Promise.all(ids.map((id) => kv.get<FeedbackEntry>(ITEM_KEY(id))));
  return Response.json({ items: items.filter(Boolean) });
}

export async function PATCH(req: Request) {
  // admin 인증 + status 변경
  // ...
}
```

**ULID / 해시 헬퍼**

ULID이 부담스러우면 `crypto.randomUUID()`로 충분. IP 해시는 `node:crypto.createHash`.

**FeedbackButton 위치**

`src/app/page.tsx`의 토스트 마운트 영역 근처:

```tsx
{state._uniqueDropToast && <UniqueDropToast .../>}
{helpOpen && <HelpModal .../>}
{process.env.NEXT_PUBLIC_FEEDBACK_ENABLED === "1" && <FeedbackButton />}
```

**관리자 화면 추가**

`AdminClient.tsx` 상단에 탭 선택 UI 또는 섹션을 누적해서 추가. 이미 1개 화면이라 비대해질 가능성 — 별도 라우트로 빼는 것도 옵션:

대안: `/admin/feedback/page.tsx` 별도 페이지.

```tsx
// src/app/admin/feedback/page.tsx
import { notFound } from "next/navigation";
import FeedbackAdminClient from "./Client";

export default async function Page({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const expected = process.env.ADMIN_KEY;
  const params = await searchParams;
  if (!expected || params.key !== expected) notFound();
  return <FeedbackAdminClient adminKey={params.key} />;
}
```

`AdminClient.tsx`에는 `<Link href={`/admin/feedback?key=${adminKey}`}>` 만 추가.

**검증**

- [ ] 비로그인 IP에서 1분에 4번 보내면 4번째에 429
- [ ] 캐릭터 만든 상태에서 보내면 context에 nickname/level 자동 첨부
- [ ] /admin/feedback에서 목록 조회, status 변경
- [ ] KV 미설정 시 503 응답 (UI는 버튼만 노출 X)

---

## Phase 2 — 운영 시작 직후 (1주일 이내)

### 2.1 Vercel Analytics (0.5일)

**의존성**

```bash
npm install @vercel/analytics
```

**파일 변경**

`src/app/layout.tsx`:

```tsx
import { Analytics } from "@vercel/analytics/react";
// ...
<body className="min-h-full flex flex-col">
  {children}
  <Analytics />
</body>;
```

**커스텀 이벤트** (선택, 점진 도입)

```ts
// src/lib/analytics.ts
import { track as vercelTrack } from "@vercel/analytics";

export const track = (event: string, props?: Record<string, string | number | boolean | null>) => {
  if (typeof window === "undefined") return;
  vercelTrack(event, props);
};
```

`store.ts`에서 호출:

| 트리거         | 이벤트                            |
| -------------- | --------------------------------- |
| 보스 처치      | `boss_killed` { bossName, turns } |
| 2차 전직       | `class_advanced` { from, to }     |
| 유니크 드랍    | `unique_drop` { item, boss }      |
| 첫 캐릭터 생성 | `character_created` { className } |

**검증**

- [ ] Vercel 대시보드 Analytics 탭에 데이터 도착 (배포 후 ~1시간)
- [ ] DSN/플래그 없어도 dev에서 동작 정상

---

### 2.2 게임 메트릭스 기본 (1.5 ~ 2일)

**파일 변경**

| 위치                                | 종류 | 내용                           |
| ----------------------------------- | ---- | ------------------------------ |
| `src/lib/metrics.ts`                | 신규 | KV 카운터 헬퍼 모듈            |
| `src/app/api/stats/global/route.ts` | 신규 | 글로벌 통계 GET (캐시 1h)      |
| `src/app/api/coop/route.ts`         | 수정 | 보스 처치/공격 시 metrics 호출 |
| `src/app/api/arena/route.ts`        | 수정 | 신규 닉네임 등록 시 metrics    |
| (기타 API)                          | 수정 | 활동 기록 (`addActive`)        |

**메트릭스 헬퍼** (`src/lib/metrics.ts`)

```ts
import { kv } from "@vercel/kv";

const today = () => new Date().toISOString().slice(0, 10);
const DAY_TTL = 90 * 24 * 60 * 60;

export async function addActive(nickname: string) {
  const key = `stats:day:${today()}:active`;
  await kv.sadd(key, nickname);
  await kv.expire(key, DAY_TTL);
}

export async function addNewPlayer(nickname: string) {
  // first-time 등록 시만
  const seen = await kv.sadd("stats:players:all", nickname); // 1이면 신규
  if (seen === 1) {
    await kv.incr(`stats:day:${today()}:new`);
    await kv.expire(`stats:day:${today()}:new`, DAY_TTL);
    await kv.incr("stats:global:totalPlayers");
  }
}

export async function addBossKill(bossName: string) {
  await kv.hincrby(`stats:day:${today()}:bossKills`, bossName, 1);
  await kv.expire(`stats:day:${today()}:bossKills`, DAY_TTL);
  await kv.hincrby("stats:global:bossKills", bossName, 1);
}

export async function setClass(nickname: string, className: string) {
  await kv.hset("stats:classes", { [nickname]: className });
}
```

**API** (`src/app/api/stats/global/route.ts`)

```ts
import { kv } from "@vercel/kv";

const CACHE_KEY = "stats:cache:global";
const CACHE_TTL = 60 * 60;

export async function GET() {
  const cached = await kv.get(CACHE_KEY);
  if (cached) return Response.json(cached);

  const totalPlayers = (await kv.get<number>("stats:global:totalPlayers")) ?? 0;
  const dauKey = `stats:day:${new Date().toISOString().slice(0, 10)}:active`;
  const dau = (await kv.scard(dauKey)) ?? 0;
  const bossKills = (await kv.hgetall("stats:global:bossKills")) ?? {};
  const top = Object.entries(bossKills)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5);

  const payload = { totalPlayers, dau, topBossKills: top };
  await kv.set(CACHE_KEY, payload, { ex: CACHE_TTL });
  return Response.json(payload);
}
```

**삽입 위치**

```ts
// /api/coop POST 내, 공격 처리 직후
if (boss.hp <= 0 && !boss.defeated) {
  // 이미 처리된 처치 흐름 안에
  await addBossKill(boss.name);
}
// 모든 action 처리 끝에
await addActive(body.nickname);
```

```ts
// /api/arena POST 내, snapshot 등록 시
await addNewPlayer(snap.nickname);
await setClass(snap.nickname, snap.className);
await addActive(snap.nickname);
```

**검증**

- [ ] 새 닉네임 첫 코옵 공격 시 totalPlayers 1 증가
- [ ] 보스 처치 후 stats:global:bossKills 증가
- [ ] /api/stats/global 응답 구조 확인 + 1시간 캐시 동작
- [ ] KV 없을 때 graceful (503 또는 빈 응답)

---

## Phase 3 — 운영 안정화 (2~4주)

### 3.1 시계열 API + 관리자 메트릭스 페이지 (3일)

**파일 변경**

| 위치                                        | 종류 | 내용                      |
| ------------------------------------------- | ---- | ------------------------- |
| `src/app/api/stats/timeseries/route.ts`     | 신규 | from/to/metric 파라미터   |
| `src/app/admin/metrics/page.tsx`            | 신규 | 서버 컴포넌트 (auth)      |
| `src/app/admin/metrics/Client.tsx`          | 신규 | 차트 + KPI 카드           |
| `src/components/charts/SimpleLineChart.tsx` | 신규 | 의존성 없는 SVG 라인 차트 |

**차트 라이브러리 선택**

| 옵션                  | 비고                                             |
| --------------------- | ------------------------------------------------ |
| Recharts              | 기능 풍부, ~30KB                                 |
| Chart.js              | 무거움                                           |
| **자체 SVG 컴포넌트** | 단순한 라인 차트는 200줄로 충분, 의존성 0 — 추천 |

KPI 4개 + 라인 차트 1~2개면 의존성 없이 충분.

### 3.2 관리자 콘솔 통합 정리 (1~2일)

`/admin` → 탭 형식 또는 라우트 분할:

```
/admin              # 인덱스 (각 도구로의 링크)
  ├─ /admin/grant       # 기존 EXP 부여
  ├─ /admin/feedback    # Phase 1
  ├─ /admin/metrics     # Phase 3.1
  ├─ /admin/coop        # 활성 코옵 보스 관리 (옵션)
  └─ /admin/system      # KV / env / rate-limit 점검 (옵션)
```

각 페이지는 동일 ADMIN_KEY 체크 패턴 재사용.

---

## Phase 4 — 정밀 모니터링 (필요 시)

### 4.1 Webhook 알림 (0.5일)

`src/lib/alert.ts`:

````ts
import { kv } from "@vercel/kv";

export async function notifyAdmin(text: string, context?: object) {
  const url = (await kv.get<string>("admin:webhook_url")) ?? process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  const payload = context
    ? {
        text,
        attachments: [
          { color: "warning", text: "```\n" + JSON.stringify(context, null, 2) + "\n```" },
        ],
      }
    : { text };
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
````

호출 지점:

- `/api/feedback` POST 직후 (신규 피드백)
- Sentry 측 Slack 통합으로 대체 가능

### 4.2 Rate-limit 가시화 (0.5일)

신규 메트릭:

- `rl:metrics:429:{path}:{day}` — INCR (어떤 엔드포인트가 차단됐는지)
- 관리자 시스템 페이지에서 카운터 조회

**rate-limit.ts** 수정:

```ts
if (!result.allowed) {
  await kv.hincrby(`rl:429:${today()}`, path, 1).catch(() => {});
}
```

---

## 전체 작업량 추정

| Phase    | 항목              | 일정 (1인 기준) |
| -------- | ----------------- | --------------- |
| 1.1      | Sentry            | 0.5 ~ 1일       |
| 1.2      | 피드백 폼         | 1 ~ 1.5일       |
| 2.1      | Vercel Analytics  | 0.5일           |
| 2.2      | 메트릭스 기본     | 1.5 ~ 2일       |
| 3.1      | 시계열 + 차트     | 3일             |
| 3.2      | 관리자 콘솔 정리  | 1 ~ 2일         |
| 4.1      | Webhook 알림      | 0.5일           |
| 4.2      | Rate-limit 가시화 | 0.5일           |
| **합계** |                   | **9 ~ 11일**    |

---

## 의존성 / 환경 변수 요약

### npm install (Phase별 누적)

```bash
# Phase 1
npm install @sentry/nextjs

# Phase 2
npm install @vercel/analytics

# Phase 3 (선택, 차트 라이브러리 쓸 때만)
# npm install recharts
```

### 환경 변수 추가 (Vercel + .env.local)

```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=my-org
SENTRY_PROJECT=my-project
SENTRY_AUTH_TOKEN=...                      # source map 업로드 시
NEXT_PUBLIC_FEEDBACK_ENABLED=1
SLACK_WEBHOOK_URL=https://hooks.slack.com/...   # Phase 4
IP_SALT=random-string-here                 # IP 해시 솔트
```

`.env.example` 신규 생성 권장.

---

## 위험 요소 / 회피책

| 위험                                                         | 회피책                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Sentry 무료 한도(5k errors/m) 초과                           | `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0`       |
| KV 명령 한도 초과 (Hobby 30k/day)                            | 메트릭스는 hash로 묶어 1 hgetall로 조회 / 쓰기 비번도 합치기 |
| 피드백 어뷰즈                                                | rate-limit 3/분 + 본문 길이 제한 + IP 해시 추적              |
| 분석 도구로 인한 PII 유출                                    | beforeSend 마스킹 + 캐릭터 이름 hash 또는 미수집             |
| `next.config.ts`에 withSentryConfig wrap이 빌드 깨질 수 있음 | 별도 PR로 분리, Phase 1 가장 처음에 배포 검증                |
| `<Analytics />` 렌더로 SSR 출력 변동                         | Vercel SDK는 안전, 개발 환경에선 noop                        |

---

## 도입 순서 (권장)

1. **`.env.example` 작성** — 배포 환경 셋업 표준화
2. **Phase 1.1 Sentry** — 출시 전 가장 큰 가치 (운영 첫 24시간 핵심)
3. **Phase 1.2 피드백 폼** — 사용자 피드백 수집 시작
4. **Phase 2.1 Vercel Analytics** — 트래픽 / Web Vitals 가시화
5. **Phase 2.2 메트릭스 기본** — DAU / 인기도 추적 시작
6. **Phase 3 운영 콘솔 정리** — 운영 한 달 후 데이터 축적되면 대시보드 필요성 명확
7. **Phase 4 정밀 알림** — 첫 주간 운영 후 잡음 vs 신호 판별 후 도입

---

## 체크리스트 (운영팀이 보는 최종 형태)

> 출시 직전:
>
> - [ ] Sentry DSN 입력, 테스트 에러 캡처 확인
> - [ ] Vercel Analytics 활성, 첫 페이지뷰 기록 확인
> - [ ] 피드백 폼 발송 테스트, 관리자 페이지에서 조회
> - [ ] `NEXT_PUBLIC_TEST_MODE=0` (운영 밸런스)
> - [ ] `.env.example`로 모든 환경변수 문서화

> 운영 첫 주:
>
> - [ ] DAU / 신규 / 직업 분포 추적 시작
> - [ ] 첫 critical Sentry 이슈 트리아지
> - [ ] 첫 주 피드백 정리

> 운영 한 달:
>
> - [ ] 메트릭스 시계열 그래프 도입
> - [ ] Sentry 알림 임계 조정
> - [ ] Rate limit 임계 재검토
