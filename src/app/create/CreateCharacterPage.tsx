"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/adventure/profile/useProfile";
import { CreateCharacterForm } from "@/components/CreateCharacterForm";

// 이미 캐릭터가 있으면 게임 화면으로 돌려보낸다. 생성 성공 시에도 동일하게 / 로 이동.
export function CreateCharacterPage() {
  const router = useRouter();
  const profile = useProfile();

  useEffect(() => {
    if (!profile.needsSetup) router.replace("/");
  }, [profile.needsSetup, router]);

  if (!profile.needsSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        이동 중...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <CreateCharacterForm
          onSubmit={profile.submit}
          onSuccess={() => router.replace("/")}
        />
      </div>
    </div>
  );
}
