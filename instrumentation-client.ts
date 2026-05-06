// Next.js client-side instrumentation entrypoint
import "./sentry.client.config";

// 라우터 트랜지션 추적 (선택)
export { captureRouterTransitionStart as onRouterTransitionStart } from "@sentry/nextjs";
