import OrderDetailClient from "./OrderDetailClient";

// Customer quote/order summary ({slug}.spattoo.com/orders/:id) — the screen the
// quote email links to: design + itemized price + delivery, with Accept / Decline.
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  return <OrderDetailClient slug={slug} orderId={id} />;
}
