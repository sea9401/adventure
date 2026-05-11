import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";

const PUBLIC_PATHS = [
  "/sign-in",
  "/api/health",
  "/api/version",
  "/api/chat/cleanup",
  "/api/bulletin/cleanup",
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
