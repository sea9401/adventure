import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 클라이언트 번들에 박히는 빌드 식별자 — VersionCheck 가 /api/version 응답과 비교해
  // 새 배포를 감지한다. NEXT_PUBLIC_* 는 빌드 시점에 인라인되므로 로드한 빌드의 SHA 가 박힌다.
  // 로컬/CLI 빌드(git SHA 없음) 는 "dev" → VersionCheck 가 비교를 건너뛴다.
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.VERCEL_DEPLOYMENT_ID ??
      "dev",
  },
  // 서비스 워커는 항상 최신 버전을 받아야 — 캐싱하면 옛 SW 가 활성화된 채로 남는다.
  // /public/sw.js 는 Next.js 가 자동 정적 서빙 — 헤더만 보강.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
