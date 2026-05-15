import { Suspense } from "react";
import { PlayerProfileView } from "./PlayerProfileView";

// 다른 모험가의 공개 프로필 페이지. 모달에서 별도 라우트로 분리 — 랭킹/채팅 이름 클릭에서 진입.
// 인증 필요 (미들웨어가 /sign-in 으로 가드).
export default async function Page({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return (
    <Suspense fallback={null}>
      <PlayerProfileView name={decoded} />
    </Suspense>
  );
}
