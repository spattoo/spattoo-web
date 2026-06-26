"use client";

import * as Sentry from "@sentry/nextjs";

// Attach identifying context to every subsequent Sentry event. Called per surface
// (storefront / designer / customer-quotes / baker-app) once identity is known, so
// errors are triageable by who/where.
export function setTelemetryContext(ctx: {
  surface?: string;
  bakerSlug?: string;
  userId?: string;
  role?: "customer" | "baker";
}) {
  if (ctx.surface) Sentry.setTag("surface", ctx.surface);
  if (ctx.bakerSlug) Sentry.setTag("baker_slug", ctx.bakerSlug);
  if (ctx.role) Sentry.setTag("role", ctx.role);
  if (ctx.userId) Sentry.setUser({ id: ctx.userId });
}

// Transport that bridges core's vendor-neutral telemetry (reportError/ErrorBoundary
// inside CakeDesigner/OrdersPanel) → Sentry. Injected via configureTelemetry() — see
// coreTelemetryBridge — only on routes where the core bundle is already loaded.
export const sentryTransport = {
  capture(error: Error, context: Record<string, unknown>) {
    Sentry.captureException(error, { extra: context });
  },
  setContext(context: Record<string, unknown>) {
    Sentry.setContext("app", context);
  },
};
