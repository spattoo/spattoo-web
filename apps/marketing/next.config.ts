import type { NextConfig } from "next";
// Plain .mjs shared with apps/app — typed via its JSDoc annotations.
import { securityHeadersConfig } from "../../shared/securityHeaders.mjs";

const nextConfig: NextConfig = {
  // Security response headers (CSP + friends), shared with apps/app.
  // CSP is REPORT-ONLY until CSP_ENFORCE=true. See shared/securityHeaders.mjs.
  async headers() {
    return securityHeadersConfig(process.env);
  },
  // three/drei ship modern ES2022 (class `static {}` blocks) that Safari < 16.4
  // can't parse → "Unexpected token '{'" → the client-only 3D hero never mounts
  // (blank on Safari 15, i.e. India's older iOS). Next doesn't transpile
  // node_modules by default, so name them; the Safari-15 floor is in browserslist.
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],

  // ── /o/:orderId — the customer-facing order link ────────────────────────────
  // Every order notification we send points at `www.spattoo.com/o/<orderId>`, and
  // this hands that path to the API, which looks the order up and redirects to the
  // right bakery's storefront (`spattoo-api` routes/orderLink.js).
  //
  // WHY THE LINK USES THIS HOST AT ALL: the storefront is a subdomain per baker, so
  // the natural link has a host that changes with every bakery. A WhatsApp URL
  // button's base — host included — is fixed when Meta approves the template, and a
  // DLT CTA whitelist is per domain. Neither can express a per-baker host. One fixed
  // host makes the link a valid button AND a single whitelist entry.
  //
  // A REWRITE, not a redirect, and that distinction is the point: the browser keeps
  // `www.spattoo.com` in the address bar. A redirect would bounce the customer to the
  // API host, which is exactly the host we are trying not to put in front of them.
  //
  // Done here rather than in the marketing app itself because this app holds no
  // database credentials and no API client; adding either, for one redirect, buys a
  // new env var, a new failure mode and a network hop.
  async rewrites() {
    // ⚠️ DERIVED FROM THE BASE DOMAIN, not from NEXT_PUBLIC_API_URL alone. That variable is set on the
    // baker app and NOT on marketing — this site has always built its own API URL from the base
    // domain (lib/domain.ts: `https://api.${BASE_DOMAIN}`, exactly as it builds APP_URL). The first
    // version of this rewrite required NEXT_PUBLIC_API_URL and returned [] without it, so on every
    // real marketing deploy it would have quietly registered nothing and `/o/*` would have 404'd —
    // every button in every customer message dead, with no error anywhere.
    //
    // Same precedence as shared/securityHeaders.mjs, which derives the API origin for connect-src the
    // same way and for the same reason: mirroring the derivation is what stops the two drifting. That
    // module records the identical bug — the CSP not knowing the host the demo form posted to.
    //
    // ⚠️ THE `|| "spattoo.com"` IS THE IMPORTANT PART, and it is copied from lib/domain.ts, which
    // chose it for this exact reason: "defaults to prod so an unset prod build is safe". This rewrite
    // is the ONLY thing standing between an approved WhatsApp button and a 404 — the templates carry
    // `https://www.spattoo.com/o/{{1}}`, approved at Meta and not editable — so a build that
    // registered NO rewrite would break every customer link in every message, with nothing in any log
    // to find it by. Returning [] on an unset variable was exactly that trap.
    //
    // ⚠️ AND THIS DEPLOY IS LOAD-BEARING FOR CUSTOMER LINKS. www.spattoo.com is served by THIS Vercel
    // project (DNS is on Vercel, so there is no edge rule that could bypass it), and the approved
    // button base cannot be moved without re-approving all three templates. Treat a marketing deploy
    // as touching customer messaging, not just the website.
    const base = process.env.NEXT_PUBLIC_BASE_DOMAIN || "spattoo.com";
    const api = process.env.NEXT_PUBLIC_API_URL || `https://api.${base}`;
    return [{ source: "/o/:orderId", destination: `${api.replace(/\/+$/, "")}/o/:orderId` }];
  },
};

export default nextConfig;
