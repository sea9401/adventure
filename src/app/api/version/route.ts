// GET /api/version — 현재 배포된 빌드 식별자. 클라가 로드한 빌드(NEXT_PUBLIC_BUILD_ID)와
// 비교해 새 배포를 감지하는 데 쓰인다 (src/components/VersionCheck.tsx).
// 인증 불필요 (proxy.ts 의 isPublic). 캐시 금지 — 항상 현재 배포의 값을 읽도록.
//
// NEXT_PUBLIC_BUILD_ID 는 next.config.ts 가 빌드 시점에 결정해 클라 번들 + 서버 양쪽에 인라인한다.
// (옛날엔 여기서 VERCEL_* env 를 직접 읽었는데, AWS 로 옮긴 뒤로는 그 값이 없어 항상 "dev" 였다.)

export const dynamic = "force-dynamic";

export async function GET() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
  return Response.json(
    { buildId },
    { headers: { "cache-control": "no-store" } },
  );
}
