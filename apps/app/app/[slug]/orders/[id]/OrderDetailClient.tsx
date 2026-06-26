"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../../lib/supabase";
import { makeCustomerApiClient } from "../../../../lib/api";
import { setTelemetryContext } from "../../../../lib/telemetry";

const STATUS_LABEL: Record<string, string> = {
  initiated: "Draft",
  requested: "Awaiting quote",
  quoted: "Quote ready",
  quote_approved: "Awaiting confirmation",
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
  advance_amount: number | null;
  quote_note: string | null;
  advance_paid_at: string | null;
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

type Baker = { name?: string; whatsapp?: string | null; phone?: string | null };

export default function OrderDetailClient({ slug, orderId }: { slug: string; orderId: string }) {
  const supabase = getSupabase();
  const api = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  const [order, setOrder] = useState<Order | null>(null);
  const [baker, setBaker] = useState<Baker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Talk-to-baker panel
  const [talkOpen, setTalkOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  useEffect(() => setTelemetryContext({ surface: "customer-quote-detail", bakerSlug: slug, role: "customer" }), [slug]);

  useEffect(() => {
    let alive = true;
    api.fetchMyOrder(orderId).then((o: Order) => alive && setOrder(o)).catch((e: Error) => alive && setError(e.message));
    api.fetchBakerProfile().then((r: { baker: Baker }) => alive && setBaker(r?.baker ?? null)).catch(() => {});
    return () => { alive = false; };
  }, [api, orderId]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.acceptQuote(orderId);
      setOrder((o) => (o ? { ...o, ...updated } : o));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!msg.trim()) return;
    setMsgBusy(true);
    try {
      await api.sendOrderMessage(orderId, msg.trim());
      setMsgSent(true);
      setMsg("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMsgBusy(false);
    }
  }

  if (error && !order) return <Centered>{error}</Centered>;
  if (!order) return <Centered>Loading…</Centered>;

  const price = order.final_price ?? order.quoted_price;
  const bakerName = order.baker_name ?? baker?.name ?? "the baker";
  const reviewable = order.status === "quoted" && !order.quote_stale;
  const flavours = (order.flavours ?? []).map((f) => f.name ?? f.flavour).filter(Boolean);
  const items = Array.isArray(order.quote_line_items) ? order.quote_line_items : [];
  const waDigits = (baker?.whatsapp ?? "").replace(/[^\d]/g, "");

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
      {order.advance_amount != null && (order.status === "quoted" || order.status === "quote_approved") && (
        <p style={S.meta}>Advance to confirm: <b style={{ color: "#2A2024" }}>₹{order.advance_amount}</b></p>
      )}

      {/* Baker's personal note with the quote */}
      {order.quote_note && (
        <p style={S.noteCard}>&ldquo;{order.quote_note}&rdquo; — {bakerName}</p>
      )}

      {/* State messages */}
      {order.status === "quoted" && order.quote_stale && (
        <p style={S.warn}>You changed the design after this quote — {bakerName} will re-confirm the price before you approve it.</p>
      )}
      {order.status === "requested" && <p style={S.meta}>Your request is with {bakerName}. You&apos;ll get a price here soon.</p>}
      {order.status === "quote_approved" && (
        <p style={S.ok}>You&apos;re happy with the price — lovely! {order.advance_amount != null ? `Pay the ₹${order.advance_amount} advance` : "Pay the advance"} and {bakerName} will confirm your order. Use the buttons below to reach them.</p>
      )}
      {order.status === "confirmed" && <p style={S.ok}>Confirmed — thank you! {bakerName} is on it.</p>}

      {items.length > 0 && (
        <Section title="Price breakdown">
          {items.map((it, i) => (
            <Row key={i} label={String(it.label ?? it.name ?? "Item")} value={it.amount != null ? `₹${it.amount}` : ""} />
          ))}
          {price != null && <Row label="Total" value={`₹${price}`} strong />}
        </Section>
      )}
      {order.quote_valid_until && reviewable && <p style={S.meta}>Quote valid until {fmtDate(order.quote_valid_until)}.</p>}

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

      {/* Approve — only while the quote is open */}
      {reviewable && (
        <>
          <button disabled={busy} onClick={approve} style={S.approve}>
            {busy ? "One moment…" : "I'm happy with the price"}
          </button>
          <p style={S.balance}>
            Every cake is priced for its ingredients and the hours of handwork that go into it. If you&apos;d like to talk anything through, {bakerName} is happy to help.
          </p>
          <button onClick={() => setTalkOpen((v) => !v)} style={S.talkLink}>Have a question? Talk to {bakerName}</button>
        </>
      )}

      {/* Talk-to-baker: in-app note + direct contact (available while open / approved) */}
      {(talkOpen || order.status === "quote_approved") && (reviewable || order.status === "quote_approved") && (
        <div style={S.talkPanel}>
          {msgSent ? (
            <p style={{ ...S.meta, color: "#2C4433", fontWeight: 700, margin: 0 }}>Sent — {bakerName} will get back to you.</p>
          ) : (
            <>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={3}
                placeholder={`Write a note to ${bakerName}…`}
                style={S.textarea}
              />
              <button disabled={msgBusy || !msg.trim()} onClick={sendMessage} style={S.sendBtn}>
                {msgBusy ? "Sending…" : "Send note"}
              </button>
            </>
          )}
          {(waDigits || baker?.phone) && (
            <div style={S.contactRow}>
              {waDigits && <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" style={S.contactBtn}>WhatsApp</a>}
              {baker?.phone && <a href={`tel:${baker.phone}`} style={S.contactBtn}>Call</a>}
            </div>
          )}
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
  thumb: { width: "100%", height: 200, borderRadius: 16, background: "#F4F1EC", border: "1px solid #ECE5DE", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%", objectFit: "contain" },
  statusRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 },
  badge: { fontSize: 12, fontWeight: 700, color: "#2C4433", background: "#EAF0EC", borderRadius: 20, padding: "4px 12px" },
  price: { fontSize: 26, fontWeight: 800 },
  sectionTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#bbb", borderBottom: "1px solid #F0EDE8", paddingBottom: 6, marginBottom: 12 },
  noteCard: { fontSize: 14, fontStyle: "italic", color: "#444", background: "#F6F4EF", borderRadius: 12, padding: "12px 14px", marginTop: 14, lineHeight: 1.5 },
  warn: { fontSize: 13, color: "#7a5b00", background: "#FEF9C3", border: "1px solid #FCD34D", borderRadius: 10, padding: "10px 12px", marginTop: 12, lineHeight: 1.5 },
  ok: { fontSize: 14, color: "#2C4433", background: "#EAF0EC", borderRadius: 10, padding: "10px 12px", marginTop: 12, fontWeight: 600, lineHeight: 1.5 },
  meta: { fontSize: 13, color: "#888", marginTop: 12 },
  approve: { width: "100%", marginTop: 26, padding: "15px", borderRadius: 12, border: "none", background: "#2C4433", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" },
  balance: { fontSize: 12.5, color: "#999", lineHeight: 1.6, marginTop: 12, textAlign: "center" },
  talkLink: { display: "block", width: "100%", marginTop: 4, padding: 8, background: "none", border: "none", color: "#2C4433", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" },
  talkPanel: { marginTop: 14, padding: 14, borderRadius: 12, background: "#FAF8F4", border: "1px solid #ECE5DE", display: "flex", flexDirection: "column", gap: 10 },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E0DDD8", fontSize: 14, fontFamily: "inherit", color: "#222", outline: "none", resize: "vertical", boxSizing: "border-box" },
  sendBtn: { alignSelf: "flex-start", padding: "9px 18px", borderRadius: 10, border: "none", background: "#2C4433", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  contactRow: { display: "flex", gap: 10 },
  contactBtn: { flex: 1, textAlign: "center", padding: "10px", borderRadius: 10, border: "1.5px solid #E0DDD8", background: "#fff", color: "#2C4433", fontSize: 13, fontWeight: 700, textDecoration: "none" },
  err: { fontSize: 13, fontWeight: 700, color: "#C0392B", marginTop: 12 },
};
