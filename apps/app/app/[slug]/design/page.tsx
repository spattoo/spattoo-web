// Placeholder for the customer designer. Mounting <CakeDesigner orderMode="customer">
// here is the next task — it needs a full customer-facing apiClient (elements,
// element-types, textures, materials, tags, baker-by-slug) served publicly/by the
// customer session, plus the @spattoo/designer peer deps. Tracked separately.
export default async function DesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main style={{ fontFamily: "sans-serif", padding: 48 }}>
      <h1>Designer</h1>
      <p>Customer designer for <b>{slug}</b> mounts here (next task).</p>
    </main>
  );
}
