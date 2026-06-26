import * as Sentry from "@sentry/nextjs";

// Client-side Sentry init (runs once at app startup, before app code). No-ops when
// NEXT_PUBLIC_SENTRY_DSN is unset, so dev/local works with zero config. Errors only
// for now — no performance tracing.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_ENV ?? "development",
  });
}

// Lets Sentry tie errors to client-side navigations (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
