"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../../lib/supabase";
import { makeCustomerApiClient } from "../../../../lib/api";
import { setTelemetryContext } from "../../../../lib/telemetry";

const STATUS_LABEL: Record<string, string> = {
  initiated: "Draft",
  requested: "Awaiting quote",
  quoted: "Quote ready",
  confirmed: "Confirmed",
  in_production: "In the kitchen",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Quote expired",
};

type LineItem = { label?: string; name?: string; amount?: number | string };
type Order = {
  id: string;
  status: string;
  quoted_price: number | null;
  final_price: number | null;
  quote_line_items: LineItem[] | null;
  quote_valid_until: string | null;
  quote_stale: boolean;
  design_thumbnail_url: string | null;
  weight_kg: number | null;
  flavours: { name?: string; flavour?: string; tier?: number }[] | null;
  special_instructions: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  delivery_mode: string | null;
  delivery_address: string | null;
  baker_name: string | null;
  created_at: string;
};

export default function OrderDetailClient({ slug, orderId }: { slug: string; orderId: string }) {
  const supabase = getSupabase();
  const api = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => setTelemetryContext({ surface: "customer-quote-detail", bakerSlug: slug, role: "customer" }), [slug]);

  useEffect(() => {
    let alive = true;
    api.fetchMyOrder(orderId)
      .then((o: Order) => alive && setOrder(o))
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [api, orderId]);

  async function act(kind: "accept" | "decline") {
    setBusy(kind);
    setError(null);
    try {
      const updated = kind === "accept" ? await api.acceptQuote(orderId) : await api.declineQuote(orderId);
      setOrder((o) => (o ? { ...o, ...updated } : o));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error && !order) return <Centered>{error}</Centered>;
  if (!order) return <Centered>Loading…</Centered>;

  const price = order.final_price ?? order.quoted_price;
  const canDecide = order.status === "quoted" && !order.quote_stale;
  const flavours = (order.flavours ?? []).map((f) => f.name ?? f.flavour).filter(Boolean);
  const items = Array.isArray(order.quote_line_items) ? order.quote_line_items : [];

  return (
    <main style={S.page}>
      <p style={S.eyebrow}>{order.baker_name ?? "Your baker"}</p>
      <h1 style={S.h1}>Your quote</h1>

      <div style={S.thumb}>
        {order.design_thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={order.design_thumbnail_url} alt="Your cake" style={S.thumbImg} />
        ) : (
          <span style={{ color: "#bbb", fontSize: 13 }}>No preview</span>
        )}
      </div>

      <div style={S.statusRow}>
        <span style={S.badge}>{STATUS_LABEL[order.status] ?? order.status}</span>
        {price != null && <span style={S.price}>₹{price}</span>}
      </div>

      {order.status === "quoted" && order.quote_stale && (
        <p style={S.note}>You changed the design after this quote — {order.baker_name ?? "the baker"} will re-confirm the price before you can accept.</p>
      )}
      {order.status === "requested" && <p style={S.meta}>Your request is with the baker. You&apos;ll get a price here soon.</p>}
      {order.status === "confirmed" && <p style={S.ok}>Confirmed — thank you! Your baker will be in touch.</p>}

      {items.length > 0 && (
        <Section title="Price breakdown">
          {items.map((it, i) => (
            <Row key={i} label={String(it.label ?? it.name ?? "Item")} value={it.amount != null ? `₹${it.amount}` : ""} />
          ))}
          {price != null && <Row label="Total" value={`₹${price}`} strong />}
        </Section>
      )}
      {order.quote_valid_until && <p style={S.meta}>Quote valid until {fmtDate(order.quote_valid_until)}.</p>}

      <Section title="Cake">
        {order.weight_kg != null && <Row label="Weight" value={`${order.weight_kg} kg`} />}
        {flavours.length > 0 && <Row label="Flavours" value={flavours.join(", ")} />}
        {order.special_instructions && <Row label="Notes" value={order.special_instructions} />}
      </Section>

      <Section title="Delivery">
        <Row label="Mode" value={order.delivery_mode === "home_delivery" ? "Home delivery" : "Pickup"} />
        {order.delivery_date && <Row label="Date" value={fmtDate(order.delivery_date)} />}
        {order.delivery_time && <Row label="Time" value={order.delivery_time} />}
        {order.delivery_address && <Row label="Address" value={order.delivery_address} />}
      </Section>

      {canDecide && (
        <div style={S.actions}>
          <button disabled={!!busy} onClick={() => act("accept")} style={S.accept}>
            {busy === "accept" ? "Accepting…" : `Accept${price != null ? ` · ₹${price}` : " quote"}`}
          </button>
          <button disabled={!!busy} onClick={() => act("decline")} style={S.decline}>
            {busy === "decline" ? "…" : "Decline"}
          </button>
        </div>
      )}
      {error && <p style={S.err}>{error}</p>}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  if (!items.length) return null;
  return (
    <section style={{ marginTop: 22 }}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{items}</div>
    </section>
  );
}
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: strong ? 800 : 400 }}>
      <span style={{ color: "#888", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#2A2024", fontSize: 14, textAlign: "right" }}>{value}</span>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ ...S.page, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#777", textAlign: "center" }}>{children}</div>;
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return s; }
}

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "sans-serif", maxWidth: 560, margin: "0 auto", padding: "24px 18px 48px", color: "#2A2024" },
  eyebrow: { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#2C4433", margin: 0 },
  h1: { fontSize: 24, fontWeight: 800, margin: "4px 0 18px" },
  thumb: { width: "100%", aspectRatio: "4 / 3", borderRadius: 16, background: "#F4F1EC", border: "1px solid #ECE5DE", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%", objectFit: "contain" },
  statusRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 },
  badge: { fontSize: 12, fontWeight: 700, color: "#2C4433", background: "#EAF0EC", borderRadius: 20, padding: "4px 12px" },
  price: { fontSize: 26, fontWeight: 800 },
  sectionTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#bbb", borderBottom: "1px solid #F0EDE8", paddingBottom: 6, marginBottom: 12 },
  note: { fontSize: 13, color: "#7a5b00", background: "#FEF9C3", border: "1px solid #FCD34D", borderRadius: 10, padding: "10px 12px", marginTop: 12, lineHeight: 1.5 },
  ok: { fontSize: 14, color: "#2C4433", background: "#EAF0EC", borderRadius: 10, padding: "10px 12px", marginTop: 12, fontWeight: 700 },
  meta: { fontSize: 13, color: "#888", marginTop: 12 },
  actions: { display: "flex", gap: 10, marginTop: 26 },
  accept: { flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "#2C4433", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" },
  decline: { padding: "14px 20px", borderRadius: 12, border: "1.5px solid #E0DDD8", background: "#fff", color: "#555", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  err: { fontSize: 13, fontWeight: 700, color: "#C0392B", marginTop: 12 },
};
