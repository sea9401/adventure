import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
