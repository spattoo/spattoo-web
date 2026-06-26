import DesignerClient from "./DesignerClient";

// Customer designer for a baker's storefront ({slug}.spattoo.com/design). Mounts
// CakeDesigner in customer mode (client-only, see DesignerClient).
export default async function DesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DesignerClient slug={slug} />;
}
