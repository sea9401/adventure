import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButtons } from "./SignInButtons";

export default async function SignInPage() {
  // 이미 로그인된 상태에서 뒤로가기 등으로 이 페이지에 들어오면 홈으로 보낸다.
  // (그대로 두면 다른 공급자 버튼을 눌러 의도치 않게 별도 계정으로 갈아타게 됨 —
  //  계정 추가는 설정 메뉴의 "연동하기"를 통해서만.)
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          로그인
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          소셜 계정으로 간편하게 시작하세요
        </p>
      </div>
      <SignInButtons />
    </div>
  );
}
