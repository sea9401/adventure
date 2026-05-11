import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { rawDb } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema";
import { authConfig } from "@/auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

// lazy 초기화: 팩토리는 요청 시점에 호출되므로 DrizzleAdapter(rawDb()) 가
// 모듈 평가(빌드 타임 page-data 수집)가 아니라 첫 요청 때 DB 에 연결한다.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: DrizzleAdapter(rawDb(), {
    usersTable: users as any,
    accountsTable: accounts as any,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens as any,
  }),
  session: { strategy: "jwt" as const },
  providers: [
    // allowDangerousEmailAccountLinking: 같은 이메일로 복수 공급자 연동 허용
    // (Google 로 가입한 유저가 카카오로도 로그인 시 같은 계정으로 통합).
    Google({ allowDangerousEmailAccountLinking: true }),
    Kakao({
      allowDangerousEmailAccountLinking: true,
      // 카카오 이메일 권한이 잠겨 있을 때(사업자 미등록) ID 기반 플레이스홀더 이메일 사용.
      // kakao_<id>@kakao.oauth 형태 — 같은 카카오 계정이면 항상 동일 이메일 생성.
      profile(profile) {
        const kakaoAccount = profile.kakao_account as {
          email?: string;
          profile?: { nickname?: string; profile_image_url?: string };
        } | undefined;
        return {
          id: String(profile.id),
          name: kakaoAccount?.profile?.nickname ?? null,
          email: kakaoAccount?.email ?? `kakao_${profile.id}@kakao.oauth`,
          image: kakaoAccount?.profile?.profile_image_url ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
}));
