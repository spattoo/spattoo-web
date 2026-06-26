// Placeholder root of the customer/baker app surface (app.spattoo.com).
// Task 5 adds host-based routing: {slug}.spattoo.com → customer storefront,
// app.spattoo.com → baker app. For now this is a buildable stub.
export default function AppHome() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 48 }}>
      <h1>Spattoo</h1>
      <p>App surface — storefront &amp; baker tools land here.</p>
    </main>
  );
}
