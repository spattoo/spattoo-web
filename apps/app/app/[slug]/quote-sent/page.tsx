import QuoteSentClient from "./QuoteSentClient";

// The post-quote share screen, reached after the customer dismisses the
// "Quote Requested!" popup in the designer (redirected here with ?order=<id>).
// Reading searchParams server-side avoids a useSearchParams Suspense boundary.
export default async function QuoteSentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { slug } = await params;
  const { order } = await searchParams;
  return <QuoteSentClient slug={slug} orderId={order ?? null} />;
}
