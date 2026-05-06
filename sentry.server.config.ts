import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        // 인증 헤더 / 어드민 키 등 제거
        const h = event.request.headers as Record<string, string>;
        delete h["x-admin-key"];
        delete h["authorization"];
        delete h["cookie"];
      }
      return event;
    },
  });
}
