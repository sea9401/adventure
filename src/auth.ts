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
    Kakao({ allowDangerousEmailAccountLinking: true }),
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
