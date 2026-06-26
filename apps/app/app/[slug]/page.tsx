import StorefrontClient from "./StorefrontClient";

// Customer storefront for a baker, reached at {slug}.spattoo.com (middleware
// rewrites the subdomain to /[slug]) or /[slug] in local dev. The branding/story
// is fetched client-side by CustomerStorefront from the public storefront API.
export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <StorefrontClient slug={slug} />;
}
