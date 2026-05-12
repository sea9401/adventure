import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";

const PUBLIC_PATHS = [
  "/sign-in",
  "/api/auth",     // Auth.js OAuth 콜백 — 미들웨어 통과 필수
  "/api/health",
  "/api/version",
  "/api/chat/cleanup",
  "/api/bulletin/cleanup",
  "/api/cron", // 스케줄러(EC2 crontab / Vercel crons) 호출 — 라우트 자체가 CRON_SECRET 을 검사
];

// 미들웨어 전용 설정 — adapter 없이 edge-compatible.
// 실제 DB/OAuth 처리는 src/auth.ts (full config).
export const authConfig: NextAuthConfig = {
  providers: [Google, Kakao],
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isPublic = PUBLIC_PATHS.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + "/"),
      );
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
};
