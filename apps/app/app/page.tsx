import BakerApp from "./BakerApp";

// Client-only baker app (Supabase auth + heavy OrdersPanel) — don't prerender at
// build (it needs runtime env); render on demand.
export const dynamic = "force-dynamic";

// Root of the app surface (app.spattoo.com, and localhost root in dev). The baker
// app: sign in → order management + Send quote. Customer storefronts live at
// {slug}.spattoo.com → /[slug] (host middleware).
export default function AppHome() {
  return <BakerApp />;
}
