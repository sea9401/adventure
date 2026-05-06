# 출시 준비 + README/.env + 메트릭스 대시보드 구현 계획

> 다음 3개 영역을 한 번에 묶은 작업 계획.
> A. 출시 차단 항목 (에러 페이지·메타데이터·SEO·테스트모드 점검)
> B. README + 환경변수 가이드 보강
> C. 메트릭스 대시보드 (Phase 3 — 시계열 + 관리자 콘솔)

---

## A. 출시 차단 항목

### A.1 Node 20+ 빌드 검증

현재 개발 환경 Node 18.19. Next.js 16은 Node ≥20.9 요구.

- 작업 환경 업그레이드 후 `npm run build` 통과 확인
- 빌드 출력의 번들 사이즈 검토 (`.next/static/chunks/*` 가장 큰 청크 확인)
- 가능하면 `@next/bundle-analyzer` 도입 고려 (별도 PR)

### A.2 에러 페이지

현재 `src/app/`에 `error.tsx`/`not-found.tsx` 없음. Next.js 기본 화면 노출 중.

**신규 파일:**

- `src/app/error.tsx` — 클라이언트 컴포넌트 (런타임 에러 캐치)
- `src/app/not-found.tsx` — 404 화면
- `src/app/global-error.tsx` — root 레이아웃 자체 에러 (선택, html 태그 포함)

각 화면:

- 게임 톤 유지 (방치형 RPG 분위기)
- "홈으로", "다시 시도" 액션 버튼
- Sentry는 자동으로 에러 캡처 (별도 코드 불필요)

### A.3 메타데이터 / SEO

현재 `src/app/layout.tsx` metadata가 최소 (title + description).

**보강 항목:**

- `metadata` 객체 확장 — OG, Twitter, 키워드, 저작자
- OG 이미지 — `src/app/opengraph-image.tsx` (Next.js convention) 또는 `public/og.png`
- favicon — `src/app/icon.tsx` 동적 생성 또는 `app/favicon.ico` (이미 있음)
- `app/robots.ts` — 크롤러 가이드
- `app/sitemap.ts` — 정적 사이트맵

```ts
// 예시: src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://your-domain.com"),
  title: { default: "방치형 RPG", template: "%s | 방치형 RPG" },
  description: "텍스트 기반의 한국어 방치형 RPG. 직업 → 탐험 → 보스 → 진행.",
  keywords: ["RPG", "방치형", "텍스트 게임", "한국어"],
  openGraph: {
    type: "website",
    siteName: "방치형 RPG",
    title: "방치형 RPG",
    description: "...",
    locale: "ko_KR",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
};
```

### A.4 테스트 모드 잔재 점검

`TEST_MODE` 상수 외에 하드코딩된 테스트값이 있는지 grep 검수:

- `console.log` / `debugger`
- `// TODO`, `// FIXME`, `// HACK`
- 매직 넘버 (보상 배수, 시간 등)
- `setTimeout(..., 99999)` 같은 임시 디버그 코드

발견 시 정상값으로 환원하거나 환경변수로 분리.

### A.5 출시 차단 체크리스트

- [ ] `next build` 통과 (Node 20+)
- [ ] `error.tsx`, `not-found.tsx` 추가 + 디자인 일관성
- [ ] metadata OG/Twitter 추가, og 이미지 1장
- [ ] `robots.ts`, `sitemap.ts`
- [ ] grep `console.log\|debugger\|TODO` 검수
- [ ] `.env.example` 모든 변수 포함 (이미 있음)

---

## B. README + 환경변수 가이드 보강

### B.1 README 현황

기본 create-next-app 보일러플레이트. 게임/프로젝트 특화 정보 없음.

### B.2 보강 구조 (제안)

```markdown
# 방치형 RPG

텍스트 기반의 한국어 방치형 RPG.

## 빠른 시작

- npm install
- 환경변수 (.env.local) 설정 — see .env.example
- npm run dev → http://localhost:3000

## 환경변수

- 필수: (없음, 모두 graceful fallback)
- 선택: KV, Anthropic, Sentry, Admin 등 — .env.example 참고

## 문서

- docs/ 인덱스 링크

## 기술 스택

- Next.js 16, React 19, TypeScript, Tailwind v4, Zustand, Vercel KV

## 배포

- Vercel: 환경변수 설정 후 push 시 자동 배포
- Node 20.9+ 필수

## 라이선스

- (정해진 게 없으면 비워두거나 "Private" 표기)
```

### B.3 .env.example 점검

이미 작성된 상태. 누락된 변수가 없는지 grep으로 재검토:

- `process.env.XXX` 사용처 vs `.env.example` 비교
- 누락 시 `.env.example`에 추가

---

## C. 메트릭스 대시보드 (Phase 3)

### C.1 현황

- `src/lib/metrics.ts`: addActive/addNewPlayer/addBossKill/setClass/readGlobalStats
- `/api/stats/global`: 1시간 캐시
- `/admin/feedback`: 피드백 화면 (Phase 1.2 결과)
- 시계열 API / 관리자 메트릭스 화면 부재

### C.2 시계열 API

**파일**: `src/app/api/stats/timeseries/route.ts`

지원 metric:

- `dau` — 일별 활성 닉네임 수 (`stats:day:{day}:active` SCARD)
- `new_players` — 일별 신규 (`stats:day:{day}:new` GET)
- `boss_kills` — 일별 보스 처치 합계 (`stats:day:{day}:bossKills` HVALS sum)

```
GET /api/stats/timeseries?metric=dau&days=30
Headers: { x-admin-key }

Response: {
  metric: "dau",
  points: [{ day: "2026-04-15", value: 12 }, ...]
}
```

90일 한도 (KV TTL).

### C.3 메트릭스 헬퍼 확장

`src/lib/metrics.ts`에 추가:

```ts
export async function readTimeseries(
  metric: "dau" | "new_players" | "boss_kills",
  days: number,
): Promise<{ day: string; value: number }[]> {
  const today = new Date();
  const result: { day: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    let value = 0;
    if (metric === "dau") {
      value = (await safe(kv.scard(`stats:day:${day}:active`))) ?? 0;
    } else if (metric === "new_players") {
      value = (await safe(kv.get<number>(`stats:day:${day}:new`))) ?? 0;
    } else if (metric === "boss_kills") {
      const map = await safe(kv.hgetall<Record<string, number>>(`stats:day:${day}:bossKills`));
      value = Object.values(map ?? {}).reduce((s, v) => s + Number(v), 0);
    }
    result.push({ day, value });
  }
  return result;
}
```

### C.4 차트 컴포넌트

의존성 0의 SVG 라인 차트:

**파일**: `src/components/charts/SimpleLineChart.tsx`

```tsx
type Point = { day: string; value: number };

export function SimpleLineChart({
  points,
  height = 80,
  color = "rgb(52, 211, 153)",
}: {
  points: Point[];
  height?: number;
  color?: string;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 100;
  const h = height;
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * w;
      const y = h - (p.value / max) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <path d={path} fill="none" stroke={color} strokeWidth="0.8" />
      </svg>
      <div className="flex justify-between text-[9px] text-fg-faint">
        <span>{points[0]?.day}</span>
        <span>{points[points.length - 1]?.day}</span>
      </div>
    </div>
  );
}
```

### C.5 관리자 메트릭스 페이지

**파일:**

- `src/app/admin/metrics/page.tsx` (server, ADMIN_KEY 인증)
- `src/app/admin/metrics/Client.tsx` (KPI 카드 + 차트)

**레이아웃:**

```
┌─ KPI 카드 4개 ────────────────────────┐
│  전체  │  DAU  │  신규(오늘)  │  활성  │
│  1234  │  87   │  +5         │  Top   │
└──────────────────────────────────────┘

┌─ DAU 추이 (30일) ────────────────────┐
│  ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦      │
└──────────────────────────────────────┘

┌─ 신규 플레이어 (30일) ──┐ ┌─ 보스 처치 (30일) ──┐
│ ...                    │ │ ...                │
└────────────────────────┘ └────────────────────┘

┌─ Top 보스 처치 ─────────┐
│  거대 슬라임 왕  4,521  │
│  늑대 우두머리   3,234  │
│  ...                   │
└────────────────────────┘
```

### C.6 관리자 인덱스 갱신

`src/app/admin/AdminClient.tsx` 상단에 메트릭스 페이지 링크 추가:

```tsx
<div className="flex gap-2 text-xs">
  <Link href={`/admin/feedback?key=${adminKey}`}>📩 피드백</Link>
  <Link href={`/admin/metrics?key=${adminKey}`}>📊 메트릭스</Link>
</div>
```

### C.7 작업량

| 항목                              | 작업량  |
| --------------------------------- | ------- |
| 시계열 API + 메트릭스 헬퍼 확장   | 0.5일   |
| 차트 컴포넌트                     | 0.5일   |
| 관리자 메트릭스 페이지 + KPI 카드 | 1일     |
| 관리자 인덱스 갱신                | 0.1일   |
| **합계**                          | **2일** |

---

## 전체 도입 순서

| 단계 | 작업                                            | 예상  |
| ---- | ----------------------------------------------- | ----- |
| 1    | A.4 테스트 모드 잔재 grep 검수 + 정리           | 0.5일 |
| 2    | A.2 에러 페이지 작성 (error.tsx, not-found.tsx) | 0.5일 |
| 3    | A.3 메타데이터 / OG / robots / sitemap          | 0.5일 |
| 4    | B.1 README 보강 + B.3 .env.example 점검         | 0.5일 |
| 5    | C.2~C.6 메트릭스 대시보드 풀 구현               | 2일   |
| 6    | A.1 Node 20+ 환경에서 빌드 최종 검증            | 별도  |

총 **4일** (A.1 빌드 검증 별도, 환경 의존).

---

## 검증 / 산출물 체크리스트

### A. 출시 차단 항목

- [ ] `npm run build` 통과 (Node 20+ 환경)
- [ ] `/존재하지않는페이지` → 커스텀 404
- [ ] 컴포넌트 에러 발생 → 커스텀 error.tsx 표시
- [ ] `view-source:`로 OG 메타 태그 확인
- [ ] `/robots.txt`, `/sitemap.xml` 응답 200
- [ ] grep `console.log\|debugger\|TODO\|FIXME` 0건 (또는 의도된 항목만)

### B. 문서

- [ ] `README.md` 보강 (실행 / 환경변수 / docs / 배포)
- [ ] `.env.example`이 모든 `process.env.*` 사용처 포함
- [ ] `docs/README.md` 인덱스 최신화

### C. 메트릭스 대시보드

- [ ] `/admin/metrics?key=...` 정상 접근 (잘못된 key는 404)
- [ ] KPI 4개 카드 렌더 (KV 없을 때 0 표시)
- [ ] 30일 DAU 라인 차트 표시
- [ ] Top 보스 처치 리스트
- [ ] AdminClient에서 메트릭스 페이지 링크 동작
