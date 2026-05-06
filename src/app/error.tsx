"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-canvas text-fg-strong flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">💀</div>
        <h1 className="text-2xl font-semibold">예기치 않은 사고</h1>
        <p className="text-sm text-fg-muted leading-relaxed">
          치명적 일격으로 잠시 의식을 잃었습니다.
          <br />
          다시 시도하거나 마을로 돌아가세요.
        </p>
        {error.digest && (
          <p className="text-[10px] text-fg-faint font-mono">에러 ID: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={reset}
            className="bg-fg-strong text-canvas px-5 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="border border-line-2 text-fg-muted hover:text-fg px-5 py-2 rounded-md text-sm"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
