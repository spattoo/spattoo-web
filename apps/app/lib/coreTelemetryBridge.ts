"use client";

import { configureTelemetry } from "@spattoo/designer";
import { sentryTransport } from "./telemetry";

// Route core's internal reportError / ErrorBoundary (inside CakeDesigner, OrdersPanel)
// to Sentry. This imports from @spattoo/designer, so call it ONLY from routes that
// already load the core bundle (the designer + baker app) — never from the light
// storefront landing, to avoid pulling the designer bundle there.
let bridged = false;
export function bridgeCoreTelemetryToSentry(surface: string) {
  if (bridged) return;
  bridged = true;
  configureTelemetry({ transport: sentryTransport, surface });
}
