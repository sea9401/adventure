"use client";

import { Suspense } from "react";
import { SaveProvider } from "@/lib/storage/SaveProvider";
import { STARTER_SAVES } from "@/adventure/starterSaves";
import { CreateCharacterPage } from "./CreateCharacterPage";

// 캐릭터 생성 전용 라우트. 모달 대신 별도 페이지로 분리 — 추후 회원가입/온보딩 흐름 확장 여지.
// 인증 필요(미들웨어가 /sign-in 으로 가드). SaveProvider 로 감싸 프로필 hydrate.
export default function Page() {
  return (
    <SaveProvider starters={STARTER_SAVES}>
      <Suspense fallback={null}>
        <CreateCharacterPage />
      </Suspense>
    </SaveProvider>
  );
}
