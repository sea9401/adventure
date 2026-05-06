import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas text-fg-strong flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">🗺</div>
        <h1 className="text-2xl font-semibold">길을 잃은 모험가</h1>
        <p className="text-sm text-fg-muted leading-relaxed">
          여긴 지도에 없는 영역입니다.
          <br />
          마을로 돌아가 다시 길을 찾아보세요.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-block bg-fg-strong text-canvas px-5 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            마을로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
