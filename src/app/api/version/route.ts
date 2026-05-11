// GET /api/version — 현재 배포된 빌드 식별자. 클라가 로드한 빌드(NEXT_PUBLIC_BUILD_ID)와
// 비교해 새 배포를 감지하는 데 쓰인다 (src/components/VersionCheck.tsx).
// 인증 불필요 (proxy.ts 의 isPublic). 캐시 금지 — 항상 현재 deployment 의 env 를 읽도록.

export const dynamic = "force-dynamic";

export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    "dev";
  return Response.json(
    { buildId },
    { headers: { "cache-control": "no-store" } },
  );
}
