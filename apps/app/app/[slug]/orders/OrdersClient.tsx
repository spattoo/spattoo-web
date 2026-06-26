"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "../../../lib/supabase";
import { makeCustomerApiClient } from "../../../lib/api";
import { setTelemetryContext } from "../../../lib/telemetry";

// Customer-facing status labels (a friendly subset; the baker UI has its own).
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

type Order = {
  id: string;
  status: string;
  quoted_price: number | null;
  final_price: number | null;
  quote_stale: boolean;
  quote_valid_until: string | null;
  design_thumbnail_url: string | null;
  delivery_date: string | null;
  created_at: string;
  baker_name: string | null;
};

export default function OrdersClient({ slug }: { slug: string }) {
  const supabase = getSupabase();
  const api = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setTelemetryContext({ surface: "customer-quotes", bakerSlug: slug, role: "customer" }), [slug]);

  useEffect(() => {
    let alive = true;
    api
      .fetchMyOrders()
      .then((list: Order[]) => alive && setOrders(Array.isArray(list) ? list : []))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [api]);

  if (error && !orders) return <Centered>{error}</Centered>;
  if (!orders) return <Centered>Loading…</Centered>;
  if (!orders.length)
    return <Centered>You haven&apos;t requested any quotes yet.</Centered>;

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Your quotes</h1>
      {error && <p style={S.err}>{error}</p>}
      <div style={S.list}>
        {orders.map((o) => {
          const price = o.final_price ?? o.quoted_price;
          const reviewable = o.status === "quoted" && !o.quote_stale;
          return (
            <Link key={o.id} href={`/${slug}/orders/${o.id}`} style={{ ...S.card, textDecoration: "none", color: "inherit" }}>
              <div style={S.thumb}>
                {o.design_thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.design_thumbnail_url} alt="Cake design" style={S.thumbImg} />
                ) : (
                  <span style={{ color: "#bbb" }}>No preview</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.statusRow}>
                  <span style={S.badge}>{STATUS_LABEL[o.status] ?? o.status}</span>
                  {price != null && <span style={S.price}>₹{price}</span>}
                </div>
                {o.delivery_date && <p style={S.meta}>Delivery: {o.delivery_date}</p>}
                <p style={{ ...S.meta, color: reviewable ? "#2C4433" : "#aaa", fontWeight: 700 }}>
                  {reviewable ? "Review & accept →" : "View details →"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#777", textAlign: "center" }}>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto", padding: "24px 18px", color: "#2A2024" },
  h1: { fontSize: 22, fontWeight: 800, margin: "0 0 18px" },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  card: { display: "flex", gap: 14, border: "1px solid #ECE5DE", borderRadius: 16, padding: 14, background: "#fff" },
  thumb: { width: 76, height: 76, flexShrink: 0, borderRadius: 12, background: "#F4F1EC", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: 11 },
  thumbImg: { width: "100%", height: "100%", objectFit: "contain" },
  statusRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: { fontSize: 12, fontWeight: 700, color: "#2C4433", background: "#EAF0EC", borderRadius: 20, padding: "3px 10px" },
  price: { fontSize: 16, fontWeight: 800 },
  note: { fontSize: 12.5, color: "#7a5b00", background: "#FEF9C3", border: "1px solid #FCD34D", borderRadius: 8, padding: "6px 10px", margin: "8px 0 0", lineHeight: 1.5 },
  meta: { fontSize: 12.5, color: "#888", margin: "8px 0 0" },
  actions: { display: "flex", gap: 8, marginTop: 12 },
  accept: { padding: "9px 16px", borderRadius: 10, border: "none", background: "#2C4433", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  decline: { padding: "9px 16px", borderRadius: 10, border: "1.5px solid #E0DDD8", background: "#fff", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  err: { fontSize: 13, fontWeight: 700, color: "#C0392B" },
};
