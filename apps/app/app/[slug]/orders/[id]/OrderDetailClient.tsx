"use client";

import dynamic from "next/dynamic";
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

/* logo_transparent_url first: it is the background-removed mark, so it floats on the gate's
   tinted ground instead of sitting in its own white rectangle. Same order the storefront uses. */
type Baker = { name?: string; primary_color?: string; whatsapp?: string | null; phone?: string | null;
               logo_url?: string | null; logo_transparent_url?: string | null };
/* ⚠️ THE NAME AND COLOUR ARE NOT IN /settings. It carries delivery, store_hours, lead_time_days,
   otp_required and otp_channels — and nothing else. They come from /storefront/:slug, which this page
   already fetches for the baker card. And the channels field is `otp_channels`, not `channels`.
   Checked against the live dev storefront 31-bakers, 2026-09-18. */
type StorefrontSettings = { otp_channels?: string[]; otp_required?: boolean };
type OrderChannel = { channels?: string[] };

// Loaded the same way the designer's gate loads it — client-only, from the vendored core.
const VerifyStep = dynamic(
  () => import("@spattoo/designer").then((m) => m.VerifyStep),
  { ssr: false, loading: () => <Centered>Loading…</Centered> },
);

export default function OrderDetailClient({ slug, orderId }: { slug: string; orderId: string }) {
  const supabase = getSupabase();
  const api = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  /* ── The gate ─────────────────────────────────────────────────────────────────────────────────
   *
   * ⚠️ THIS PAGE IS REACHED FROM A MESSAGE, by someone with no session. A WhatsApp button opens the
   * in-app browser, which carries nothing from any earlier visit — so "not signed in" is the NORMAL
   * case here, not an edge one.
   *
   * It used to render `<Centered>{error}</Centered>` for any failure, and the failure was always the
   * same: `GET /api/customer/orders/<id>` returns 401 `{"error":"Unauthorized"}` without a session.
   * So a customer tapping "View quote" in their WhatsApp landed on a page showing one word —
   * "Unauthorized" — with no way forward. Found 2026-09-18 by opening the real link in a real
   * browser, before the templates carrying it were submitted.
   *
   * Nothing was ever exposed; the API refused correctly. What was broken was the experience — the
   * same bug, and the same fix, as the designer's door (see DesignerClient's gate, and the "one
   * exception" note in core's VerifyStep).
   *
   * `undefined` = still checking, and it must NOT render either branch: flashing the verify screen
   * at somebody who is already signed in is the same bug in a nicer costume.
   */
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [orderChannel, setOrderChannel] = useState<OrderChannel | null>(null);

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
    let live = true;
    supabase.auth.getSession().then(({ data }) => { if (live) setAuthed(!!data.session); });
    // A session that expires, or a sign-out in another tab, drops back to the gate rather than
    // leaving the page running on calls that will 401.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (live) setAuthed(!!session); });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  // Only fetched when the gate is actually going to show. Which channels the server accepts is its
  // decision, not ours — offering SMS before DLT clearance is how somebody waits for a code a telco
  // already dropped.
  useEffect(() => {
    if (authed !== false || settings) return;
    api.fetchBakerSettings()
      .then((s: unknown) => setSettings((s ?? {}) as StorefrontSettings))
      .catch(() => setSettings({}));   // a failed read must not strand the gate
    /* ⚠️ ASK WHICH CONTACT WE HOLD, rather than offering "Email me / Text me". That choice is a
       question only the server can answer — the order has a customer, and that customer has an
       email, or a phone, or both — so making somebody pick is asking them to guess, and a wrong
       guess sends a code somewhere that will never arrive.
       Phone-only was the first idea and is wrong: 4 of 17 customers on dev have no phone at all,
       which is the same gap migration 097 closed. A failed read falls back to the baker's channels,
       which is exactly today's behaviour. */
    api.fetchOrderChannel(orderId)
      .then((r: unknown) => setOrderChannel((r ?? {}) as OrderChannel))
      .catch(() => setOrderChannel({}));
    // The name and colour the gate shows. PUBLIC, so it works before there is a session — which is
    // the whole point here, since the gate is what a customer meets before they have one.
    api.fetchBakerProfile()
      .then((r: { baker: Baker }) => setBaker(r?.baker ?? null))
      .catch(() => {});
  }, [authed, settings, api, orderId]);

  useEffect(() => {
    // Waits for the session rather than firing and rendering its own 401 — that race is what put the
    // word "Unauthorized" on the screen in the first place.
    if (!authed) return;
    let alive = true;
    api.fetchMyOrder(orderId).then((o: Order) => alive && setOrder(o)).catch((e: Error) => alive && setError(e.message));
    api.fetchBakerProfile().then((r: { baker: Baker }) => alive && setBaker(r?.baker ?? null)).catch(() => {});
    return () => { alive = false; };
  }, [api, orderId, authed]);

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

  if (authed === undefined) return <Centered>Loading…</Centered>;

  if (!authed) {
    return (
      <VerifyStep
        apiBaseUrl={process.env.NEXT_PUBLIC_API_URL}
        slug={slug}
        bakerName={baker?.name}
        captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        primary={baker?.primary_color}
        /* ⚠️ THIS SCREEN IS THE WHOLE PAGE, and saying so is what gives it a background: without
           `standalone` the gate renders its in-sheet shape, which has no ground and no height, on
           top of globals.css's `body { background: #111111 }`. That was the 2026-09-18 bug.
           It is also what puts the bakery's mark, colour and card on it. This door in particular is
           reached by tapping a button in a WhatsApp message the bakery paid to send — arriving at an
           unbranded white form is the point where somebody wonders whether they followed a real link.
           Sandeep, 2026-09-19: "over all, this login screen is very boring." */
        standalone
        logoUrl={baker?.logo_transparent_url || baker?.logo_url || null}
        eyebrow="Your order"
        /* ⚠️ `otp_channels`, and the server's ORDER is its preference. Reading the wrong key meant
           falling back to ["sms"] for every baker — including 31-bakers, whose server accepts email
           ONLY. Offering a channel the server will refuse is how somebody waits for a code that was
           never sent, which is exactly what core's VerifyStep warns about. */
        channels={orderChannel?.channels ?? settings?.otp_channels ?? ["email"]}
        /* This door is not the enquiry. Nothing is sent to the baker here — the customer came
           from a WhatsApp link and is proving the address is theirs so the order will render. And
           `onBack` lands on the shop front, so "Back to my cake" names a place they were never at. */
        /* Nobody is getting in touch here either — they arrived from a message to LOOK at an order
           that already exists. The default copy would promise a call that is not coming. */
        title="Let's open your order"
        lede="It's private, so we'll send you a quick code to check it's you."
        /* ⚠️ NO NAME HERE. The field exists so a NEW customer row is not nameless — but this order
           already has one, and the message that brought them here addressed them by it. Asking again
           reads as not being believed, and puts a second field between somebody and the order they
           were invited to look at. */
        askName={false}
        submitLabel="View my order"
        backLabel={`Go to ${baker?.name ?? "the bakery"}`}
        onVerified={async (session: { access_token: string; refresh_token: string } | null) => {
          if (!session) return;
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          // onAuthStateChange flips `authed`, the order loads, and they land where the message was
          // sending them — rather than being dropped at the shop front to find their way back.
        }}
        onBack={() => { window.location.href = `/${slug}`; }}
      />
    );
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
    <div style={S.surface}>
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
        <p style={S.ok}>{bakerName} has requested {order.advance_amount != null ? `a payment of ₹${order.advance_amount}` : "a payment"} as advance to confirm your order. Please reach out to them for the payment details.</p>
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
        {order.delivery_time && <Row label="Time" value={fmtTime(order.delivery_time)} />}
        {order.delivery_address && <Row label="Address" value={order.delivery_address} />}
      </Section>

      {/* Approve — only while the quote is open */}
      {reviewable && (
        <>
          <button disabled={busy} onClick={approve} style={S.approve}>
            {busy ? "One moment…" : "I'm happy with the price"}
          </button>
          <button onClick={() => setTalkOpen((v) => !v)} style={{ ...S.talkLink, marginTop: 12 }}>Have a question? Talk to {bakerName}</button>
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
    </div>
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
  return (
    <div style={S.surface}>
      <div style={{ ...S.page, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#777", textAlign: "center" }}>{children}</div>
    </div>
  );
}
/* Postgres hands back a `time` as "12:00:00", and this went onto the customer's page verbatim —
   sitting directly under a date that had been carefully written out as "16 September 2026". Seconds
   are noise on a cake collection and nobody writes a pickup time that way.
   No date part to attach, so it is parsed by hand rather than through Date(); an unparseable value
   is shown as it came rather than dropped, because a wrong-looking time still tells the customer
   more than a missing row. */
function fmtTime(s: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  if (!Number.isFinite(h) || h > 23) return s;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return s; }
}

const S: Record<string, React.CSSProperties> = {
  /* ⚠️ THIS PAGE IS LIT FOR PAPER AND THE APP'S BODY IS BLACK. Every colour below assumes a light
     ground — #2A2024 body text, #2C4433 headings, #888 labels, cards on #F6F4EF — but apps/app
     globals.css sets `body { background: #111111 }` deliberately, "so the redirect into the app +
     the loading state never flash white", and says full-screen surfaces must draw their own
     background over it. This one did not, so "Your quote", the weight, the flavour and the delivery
     date all rendered near-black on near-black.
     Seen 2026-09-18, the first time anybody verified and actually LOOKED at the order. It is the
     destination of the customer WhatsApp link, so it was the worst page in the product to have it.
     Full-bleed, not on `page` itself: `page` is a 560px centred column, so painting it there would
     leave black gutters either side on a desktop. Same defect as core's VerifyStep wrap. */
  surface: { background: "#FFFFFF", minHeight: "100vh" },
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
