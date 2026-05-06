// Sentry instrumentation — Next.js가 server/edge 런타임 초기화 시 호출
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// API 라우트 / Server Action에서 발생한 에러를 Sentry로 자동 보고
export { captureRequestError as onRequestError } from "@sentry/nextjs";
