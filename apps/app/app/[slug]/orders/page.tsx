import OrdersClient from "./OrdersClient";

// The customer's "your quotes" view ({slug}.spattoo.com/orders): their requests +
// the baker's quotes, with accept/decline. Same origin as login/designer.
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <OrdersClient slug={slug} />;
}
