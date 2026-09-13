"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { API_BASE } from "./api";

// The baker-side apiClient for the FULL CakeDesigner (baker mode) — which contains
// the designer, dashboard, OrdersPanel + Send quote, and edit-in-3D. Auth is the
// baker's Supabase session; every call carries the Bearer token and the API
// resolves the baker from baker_appusers. The 'owner'/'staff' roles hold
// design:create + order caps, so the global catalog endpoints work.
export function makeBakerApiClient(supabase: SupabaseClient) {
  async function authFetch(path: string, opts: RequestInit = {}) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      // Preserve the server's machine code + HTTP status so callers can branch
      // (e.g. BAKER_INACTIVE / ORDER_LIMIT_REACHED) instead of string-matching.
      const err = Object.assign(new Error(e.error ?? `API ${res.status}`), {
        code: e.code as string | undefined,
        status: res.status,
      });
      throw err;
    }
    return res.json();
  }
  const authGet = (path: string) => authFetch(path);
  const publicGet = (path: string) =>
    fetch(`${API_BASE}${path}`).then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}`);
      return r.json();
    });

  // The baker's own slug (cached) — needed for the public order-create + flavours.
  let slugCache: string | null = null;
  async function bakerSlug(): Promise<string | null> {
    if (slugCache) return slugCache;
    const p = await authGet("/api/baker/profile").catch(() => null);
    slugCache = (p?.baker ?? p)?.slug ?? null;
    return slugCache;
  }

  return {
    // Where this client points. Every method below closes over API_BASE, so nothing here needed it
    // — but the storefront PREVIEW in Settings renders the real <CustomerStorefront>, which takes an
    // apiBaseUrl and does its own public unauthenticated fetches (templates, flavours, settings).
    // Exposing it here beats threading a second "where is the API" prop through the designer and
    // settings panel, when apiClient already IS that channel.
    baseUrl: API_BASE,

    // ── Baker context ─────────────────────────────────────────────────────────
    fetchBakerProfile: () => authGet("/api/baker/profile"),
    fetchBakerSettings: () => authGet("/api/baker/settings"),
    fetchMe: () => authGet("/api/me").catch(() => null),

    // Designer tour, per person (baker_appusers.tour_seen_at, migration 060). Fire-and-forget from
    // core: the tour is already on screen by the time this runs, so a failure must do nothing
    // visible — worst case it is offered once more on another device.
    markTourSeen: () => authFetch("/api/me/tour-seen", { method: "POST" }),

    // ── Legal / consent (DPDP "Layer 2") ──────────────────────────────────────
    // Record the baker's acceptance of the CURRENT version of each doc. Idempotent
    // per (subject, version) server-side. `source`: 'signup' (self-signup) | 'gate'
    // (first-login / re-consent). The current version + whether acceptance is pending
    // come from GET /api/baker/profile → pending_consents.
    recordConsent: (docKeys: string[], source: "signup" | "gate" | "reconsent") =>
      authFetch("/api/legal/consent", {
        method: "POST",
        body: JSON.stringify({ doc_keys: docKeys, source }),
      }),

    // ── Consent withdrawal + account erasure (DPDP "Layer 3") ──────────────────
    // The Privacy & Data settings screen. Withdraw applies to OPTIONAL docs only —
    // the API returns 409 { error:'necessary_consent', action:'delete_account' } for
    // required docs (tos/privacy), which route into the account-deletion flow instead.
    // Current published docs + which are `required` (drives the optional-consent list without a
    // hardcoded doc allowlist). Public endpoint; [] while nothing is published (draft phase).
    fetchLegalCurrent: () => authGet("/api/legal/current"),
    fetchConsentHistory: () => authGet("/api/legal/consent/history"),

    // The full text of a SPECIFIC version — what Settings → Your agreements hands back when a baker
    // wants the document they actually agreed to. Version is passed explicitly rather than defaulting
    // to current: the two diverge at the first amendment, and after that the current page is a
    // document the baker never saw. Public endpoint, so no auth needed.
    fetchLegalDoc: (docKey: string, version?: string) =>
      publicGet(
        `/api/legal/${encodeURIComponent(docKey)}` +
        (version ? `?version=${encodeURIComponent(version)}` : "")
      ),
    withdrawConsent: (docKeys: string[]) =>
      authFetch("/api/legal/withdraw", {
        method: "POST",
        body: JSON.stringify({ doc_keys: docKeys }),
      }),
    // Account deletion is a lifecycle: request soft-deletes now (reversible until
    // erase_after); a scheduled job erases after the retention window.
    fetchDeletionStatus: () => authGet("/api/baker/account/deletion-status"),
    requestAccountDeletion: (reason?: string) =>
      authFetch("/api/baker/account/delete", {
        method: "POST",
        body: JSON.stringify({ reason: reason ?? null }),
      }),
    restoreAccount: () =>
      authFetch("/api/baker/account/restore", { method: "POST" }),

    // ── Catalog (baker Bearer; design:create) ─────────────────────────────────
    fetchElementTypes: () => authGet("/api/element-types"),
    // Mirrors the customer client — the baker previews their own storefront through the same
    // designer, so a menu that differs between the two would make the preview a lie.
    fetchElementCategories: () => authGet("/api/element-categories"),
    fetchElements: (opts: { parentsOnly?: boolean; elementTypeId?: string; categoryId?: string } = {}) => {
      const qs = new URLSearchParams();
      if (opts.parentsOnly) qs.set("parents_only", "true");
      if (opts.elementTypeId) qs.set("element_type_id", opts.elementTypeId);
      if (opts.categoryId) qs.set("category_id", opts.categoryId);
      const q = qs.toString();
      return authGet(`/api/elements${q ? `?${q}` : ""}`);
    },
    fetchMaterials: () => authGet("/api/materials"),
    fetchTextures: () => authGet("/api/textures"),
    fetchTextStyles: () => authGet("/api/text-styles"),
    // The cake shapes admin authored — the baker designing in his own storefront sees the same catalog
    // his customers do.
    fetchCakeShapes: () => authGet("/api/cake-shapes"),
    fetchTags: () => authGet("/api/tags"),
    fetchTemplates: () => authGet("/api/templates").catch(() => []),
    fetchTemplate: (id: string) => authGet(`/api/templates/${id}`),

    // Saving a design as a template. Goes through the API (not a direct browser insert) so the
    // tenant is SERVER-resolved — the designer used to choose baker_id client-side. No rights
    // attestation here: a template is the baker's design library, seen only by their own invited
    // customers. The rights gate is storefront publish (see publishStorefront).
    createTemplate: (payload: Record<string, unknown>) =>
      authFetch("/api/baker/templates", { method: "POST", body: JSON.stringify(payload) }),
    // The exact sentence the baker affirms at publish, published + hashed server-side so we can
    // later prove which wording they saw. Null while Layer 1 is still draft.
    fetchAttestationStatement: () =>
      publicGet("/api/legal/content-rights").catch(() => null),

    // ── My Assets — images a baker or customer uploads ────────────────────────
    // An upload is PRIVATE: its owner can put it on their own cake, and nobody else sees it. That is
    // the whole safety property — it is why none of this needs a consent gate. See
    // spattoo-docs/plans/baker-uploads.md.
    //
    // `registerUpload` is what turns an R2 object into something we can manage: list it, delete it,
    // and — the part no ToS clause substitutes for — find it when its owner asks for erasure. EVERY
    // upload path calls it, including the photo-cake frame.
    registerUpload: (payload: { storage_key: string; name?: string; for_customer_id?: string }) =>
      authFetch("/api/uploads", { method: "POST", body: JSON.stringify(payload) }),
    fetchUploads: () => authGet("/api/uploads").catch(() => []),

    // ── Garnishes: chocolate pieces someone piped in the studio ────────────────────────────────
    // ⚠️ A garnish is stored as its PATHS, not a picture — see supabase/baker_garnishes.sql. The
    // thumbnail rides along as base64 and is only a tile; a failure to store it must not cost the
    // drawing, which is why the server swallows that error and keeps the row.
    fetchGarnishes: () => authGet("/api/garnishes").catch(() => []),
    saveGarnish: (payload: { name: string; payload: unknown; thumbBase64?: string | null }) =>
      authFetch("/api/garnishes", { method: "POST", body: JSON.stringify(payload) }),
    deleteGarnish: (id: number | string) =>
      authFetch(`/api/garnishes/${id}`, { method: "DELETE" }),

    // ── Card toppers: compositions someone made in the card topper studio ──────────────────────
    // ⚠️ Stored as its OBJECT LIST — the words and the shapes, never the contours cut from them —
    // see supabase/baker_card_toppers.sql. That is what lets a later improvement to how a word is
    // cut reach every topper already kept. The thumbnail rides along as base64 and is only a tile;
    // a failure to store it must not cost the composition, which is why the server swallows that
    // error and keeps the row.
    fetchCardToppers: () => authGet("/api/card-toppers").catch(() => []),
    saveCardTopper: (payload: { name: string; payload: unknown; thumbBase64?: string | null }) =>
      authFetch("/api/card-toppers", { method: "POST", body: JSON.stringify(payload) }),
    deleteCardTopper: (id: number | string) =>
      authFetch(`/api/card-toppers/${id}`, { method: "DELETE" }),
    deleteUpload: (id: number | string) =>
      authFetch(`/api/uploads/${id}`, { method: "DELETE" }),
    // Only the NAME is patchable — the storage key, the attribution and the tenant are server-derived
    // and must stay that way (spattoo-api routes/uploads.js).
    renameUpload: (id: number | string, name: string) =>
      authFetch(`/api/uploads/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),

    // PROMOTE — a baker releases one of HIS OWN images into his library, where his customers can use
    // it. Not gated (the ToS carries it), but the server refuses a CUSTOMER's upload: her photo is not
    // his to re-offer to other customers (ToS 6.2 licenses it only for what SHE directed).
    // Reversible: unlinkUpload deactivates the library copy and leaves cakes already using it intact.
    promoteUpload: (id: number | string, payload: Record<string, unknown>) =>
      authFetch(`/api/uploads/${id}/promote`, { method: "POST", body: JSON.stringify(payload) }),
    unlinkUpload: (id: number | string) =>
      authFetch(`/api/uploads/${id}/promote`, { method: "DELETE" }),

    // ── Edible Print Studio: saved sheets ──────────────────────────────────────────────────────
    // A sheet is a LAYOUT — which images, where on the A4, how big. Blaze+; every route is gated
    // server-side on the entitlement as well (spattoo-api routes/printSheets.js), so a 403 here is
    // the plan answering, not a bug.
    //
    // The LIST deliberately carries no `items`: the library screen draws names and dates, and one
    // sheet's layout is fetched only when it is opened.
    fetchPrintSheets: () => authGet("/api/print-sheets").then((r) => r.sheets ?? []),
    fetchPrintSheet: (id: number | string) => authGet(`/api/print-sheets/${id}`),
    createPrintSheet: (payload: { name: string; items?: unknown[]; guide?: unknown }) =>
      authFetch("/api/print-sheets", { method: "POST", body: JSON.stringify(payload) }),
    // PATCH is both "save" and "rename" — an omitted field means "leave it", so a rename need not
    // send the layout back and a save need not know the current name.
    updatePrintSheet: (
      id: number | string,
      payload: { name?: string; items?: unknown[]; guide?: unknown },
    ) => authFetch(`/api/print-sheets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    deletePrintSheet: (id: number | string) =>
      authFetch(`/api/print-sheets/${id}`, { method: "DELETE" }),

    // ── The notification centre ────────────────────────────────────────────────────────────────
    // A READ over the outbox — every row was already being written. `.catch(() => …)` returns an
    // empty shape rather than throwing: the bell is header furniture and must never be the reason a
    // header breaks.
    fetchNotifications: (limit = 20) =>
      authGet(`/api/notifications?limit=${limit}`).catch(() => ({ unread: 0, notifications: [] })),
    // Omit ids to mark everything read. Idempotent server-side, and only ever moves unread → read.
    markNotificationsRead: (ids?: Array<number | string>) =>
      authFetch("/api/notifications/read", {
        method: "POST",
        body: JSON.stringify(ids ? { ids } : {}),
      }),

    // ── Push: this device asking to be notified ────────────────────────────────────────────────
    // Safe to call on every load — the FCM SDK returns the same token and the API upserts on it.
    registerDeviceToken: (
      token: string,
      platform: "web" | "android" | "ios" = "web",
      // Diagnostics only, and thin on web by nature — see lib/push.ts deviceInfo().
      info: { deviceModel?: string; osVersion?: string; appVersion?: string } = {},
    ) => authFetch("/api/device-tokens", {
      method: "POST",
      body: JSON.stringify({ token, platform, ...info }),
    }),
    unregisterDeviceToken: (token: string) =>
      authFetch("/api/device-tokens", { method: "DELETE", body: JSON.stringify({ token }) }),

    // Put the image bytes in R2 (signed URL) and return the KEY — what registerUpload records.
    uploadElementImage: async (blob: Blob, filename: string) => {
      const { url, key } = await authFetch("/api/storage/sign-upload", {
        method: "POST",
        body: JSON.stringify({ folder: "elements/files/2D", filename, contentType: blob.type || "image/png", contentLength: blob.size }),
      });
      await fetch(url, { method: "PUT", headers: { "Content-Type": blob.type || "image/png" }, body: blob });
      return key as string;
    },

    // Ensure this upload has its decoration CUTOUT (subject cut out, background gone). Called when an
    // image enters a decoration context — the promote studio opening, or a direct decoration placement —
    // so the preview and the cake show a clean cutout, never a photo with a white box around it. There
    // is no manual button: an uncut decoration is simply broken, so cutting is implicit and happens only
    // where it is needed (NOT on the photo-cake frame path — a birthday photo keeps its background).
    //
    // Idempotent and cached server-side: the cut runs at most once per image, so this is safe to call
    // every time the studio opens. Returns the upload shape including `cutoutUrl`.
    ensureCutout: (id: number | string) =>
      authFetch(`/api/uploads/${id}/cutout`, { method: "POST" }),

    // Raw image bytes in, background-removed PNG out. One server chokepoint, so the model behind it
    // can change without touching the designer. NOT authFetch: that one sends and parses JSON, and this
    // is a binary round-trip in both directions.
    removeElementBg: async (file: Blob) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/elements/remove-bg`, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: file,
      });
      if (!res.ok) throw new Error(`Background removal failed (${res.status})`);
      return res.blob();
    },

    // ── Uploads + order create/design (baker placing an order; edit-in-3D save) ─
    // contentLength is REQUIRED and is signed INTO the URL: the body goes browser → R2 and never
    // passes through the API, so a size limit checked in the client is advice, not a limit. R2 rejects
    // a PUT whose body length differs from the one signed. Callers pass the blob's own .size.
    // The upload size ceiling, as the API currently has it. Read, never copied: the limit is env-tuned
    // on the API, and a hardcoded client would go on accepting files the API then 413s.
    fetchUploadLimits: () => authFetch("/api/storage/limits"),
    getSignedUploadUrl: (folder: string, filename: string, contentType: string, contentLength: number) =>
      authFetch("/api/storage/sign-upload", {
        method: "POST",
        body: JSON.stringify({ folder, filename, contentType, contentLength }),
      }),
    placeOrder: async (payload: Record<string, unknown>) =>
      authFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({ ...payload, bakerSlug: await bakerSlug() }),
      }),
    // "New Order" (manual): baker creates an order without the 3D designer. Baker is
    // resolved server-side from the token, so no bakerSlug is sent.
    createManualOrder: (payload: Record<string, unknown>) =>
      authFetch("/api/orders/manual", { method: "POST", body: JSON.stringify(payload) }),
    updateOrderDesign: (id: string, payload: unknown) =>
      authFetch(`/api/orders/${id}/design`, { method: "PATCH", body: JSON.stringify(payload) }),

    // ── Orders + quoting ──────────────────────────────────────────────────────
    fetchOrders: (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      return authGet(`/api/orders${qs ? `?${qs}` : ""}`);
    },
    // Per-day counts for the Orders → Calendar month view. Returns one entry per day
    // that has orders — never the orders themselves, so the payload stays the size of a
    // month no matter how many orders the baker takes.
    fetchOrdersCalendar: (from: string, to: string) =>
      authGet(`/api/orders/calendar?${new URLSearchParams({ from, to }).toString()}`),
    updateOrderStatus: (id: string, status: string, comment?: string) =>
      authFetch(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, comment }) }),
    editOrder: (id: string, formData: unknown) =>
      authFetch(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(formData) }),
    issueQuote: (id: string, body: { price: number; advanceAmount?: number | null; note?: string; lineItems?: unknown; validUntil?: string }) =>
      authFetch(`/api/orders/${id}/quote`, { method: "POST", body: JSON.stringify(body) }),
    fetchOrderAudit: (id: string) => authGet(`/api/orders/${id}/audit`),

    // ── Finished-cake photos (optional, ≤3; attached when marking ready) ────────
    fetchOrderPhotos: (id: string) => authGet(`/api/orders/${id}/photos`),
    saveOrderPhotos: (id: string, keys: string[]) =>
      authFetch(`/api/orders/${id}/photos`, { method: "POST", body: JSON.stringify({ keys }) }),
    deleteOrderPhoto: (id: string, photoId: string) =>
      authFetch(`/api/orders/${id}/photos/${photoId}`, { method: "DELETE" }),

    // ── X-Ray spec from a reference photo (manual orders) ──────────────────────
    // A manual order has no design_snapshot, so X-Ray has nothing to read. This asks the server to
    // work one out from the order's primary reference photo; the response carries the estimate, so
    // the designer opens the report from it directly rather than refetching the order.
    //
    // METERED — it spends an AI credit, but only when the reading is kept. Out of credits comes
    // back as 402 INSUFFICIENT_CREDITS, which authFetch preserves as err.code/err.status so the
    // caller can offer a top-up instead of showing a generic failure.
    createXraySpec: (id: string, opts: { regenerate?: boolean } = {}) =>
      authFetch(`/api/orders/${id}/design-estimate`, {
        method: "POST",
        body: JSON.stringify({ regenerate: opts.regenerate === true }),
      }),
    // The baker's corrections to that reading. Free — no model runs, and the raw spec is left
    // untouched on the server so spec-vs-corrected stays a usable accuracy signal.
    updateXraySpec: (id: string, estimate: unknown) =>
      authFetch(`/api/orders/${id}/design-estimate`, {
        method: "PATCH",
        body: JSON.stringify({ estimate }),
      }),

    // How to make ONE decoration, for a DESIGNED order where the decoration is a library element.
    // Stored on the ELEMENT, so it is charged once and every future cake using that decoration
    // includes it for free.
    //
    // Returns { notModelled: true } — and charges nothing — when the decoration is clearly printed
    // or pre-made rather than hand-modelled. That is an answer, not a failure.
    createElementDecorationSteps: (elementId: string) =>
      authFetch(`/api/elements/${elementId}/xray/decoration-steps`, { method: "POST" }),

    // The same question for a decoration that has NO library element — a reference-photo order,
    // where the decoration exists only in the customer's picture. Read from that photo and stored
    // on the order, so nothing is matched against the library and nothing can be mismatched.
    //
    // `key` identifies the decoration inside the order's xray_spec; `label` is what to look for in
    // the photo, and comes from what the model reported SEEING — never from a matched element's
    // name, which is how a cake with a bow got a faithful guide to a fondant doll.
    createXrayDecorationSteps: (orderId: string, body: { key: string; label: string }) =>
      authFetch(`/api/orders/${orderId}/xray/decoration-steps`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    // ── Reference photos (manual orders; ≤3; the order's picture) ───────────────
    fetchOrderReferencePhotos: (id: string) => authGet(`/api/orders/${id}/reference-photos`),
    saveOrderReferencePhotos: (id: string, keys: string[]) =>
      authFetch(`/api/orders/${id}/reference-photos`, { method: "POST", body: JSON.stringify({ keys }) }),
    deleteOrderReferencePhoto: (id: string, photoId: string) =>
      authFetch(`/api/orders/${id}/reference-photos/${photoId}`, { method: "DELETE" }),

    // ── Reference data ────────────────────────────────────────────────────────
    fetchOrderStatuses: () => publicGet("/api/order-statuses"),
    // Eggless / vegan / Jain / allergens — the vocabulary the order form offers.
    fetchDietaryRequirements: (bakerSlugArg?: string) =>
      bakerSlugArg
        ? publicGet(`/api/dietary-requirements?bakerSlug=${encodeURIComponent(bakerSlugArg)}`)
        : publicGet("/api/dietary-requirements"),

    // The same list flagged with THIS baker's on/off state, for the settings screen.
    fetchBakerDietaryRequirements: () => authGet("/api/baker/dietary-requirements"),

    // Which options this bakery doesn't deal in. A diet option switched off disappears
    // from the order form; an allergen switched off stays visible and is still recorded,
    // showing "can't guarantee" instead — a customer's allergy must never lose its home
    // on the form just because the bakery can't cater to it.
    updateBakerDietaryExclusions: (excludedKeys: string[]) =>
      authFetch("/api/baker/dietary-requirements/exclusions", {
        method: "PUT",
        body: JSON.stringify({ excluded_keys: excludedKeys }),
      }),
    fetchFlavours: (bakerSlugArg?: string) =>
      bakerSlugArg
        ? publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(bakerSlugArg)}`)
        : bakerSlug().then((s) => (s ? publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(s)}`) : [])),
    fetchCraftGuides: (elementIds: string[]) =>
      authGet(`/api/craft-guide?element_ids=${(elementIds ?? []).join(",")}`).catch(() => []),

    // ── Edible prints, read off an order's reference photo ─────────────────────
    // identify is FREE — a second read of a photo the order already paid to read. generate is
    // metered, one image per press, and lands in the baker's own uploads.
    // The prints already made for this order — Print & cut-outs shows them beside the catalogue
    // decorations. Unmetered, one indexed read, safe on every open.
    fetchOrderEdiblePrints: (orderId: string) =>
      authGet(`/api/orders/${orderId}/edible-prints`).catch(() => ({ prints: [] })),
    identifyEdiblePrints: (orderId: string) =>
      authFetch(`/api/orders/${orderId}/edible-prints/identify`, { method: "POST" }),
    generateEdiblePrint: (orderId: string, payload: unknown) =>
      authFetch(`/api/orders/${orderId}/edible-prints/generate`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    // ── Customers ─────────────────────────────────────────────────────────────
    fetchCustomers: () => authGet("/api/baker/customers"),
    createCustomer: (payload: unknown) =>
      authFetch("/api/baker/customers", { method: "POST", body: JSON.stringify(payload) }),
    updateCustomer: (id: string, payload: unknown) =>
      authFetch(`/api/baker/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    deactivateCustomer: (id: string) =>
      authFetch(`/api/baker/customers/${id}/deactivate`, { method: "PATCH" }),
    reactivateCustomer: (id: string) =>
      authFetch(`/api/baker/customers/${id}/reactivate`, { method: "PATCH" }),
    inviteCustomer: (payload: unknown) =>
      authFetch("/api/baker/customers/invite", { method: "POST", body: JSON.stringify(payload) }),

    // ── Dashboard ─────────────────────────────────────────────────────────────
    fetchDashboard: () => authGet("/api/baker/dashboard"),
    fetchDashboardBreakdown: (period: string) =>
      authGet(`/api/baker/dashboard/breakdown?period=${encodeURIComponent(period)}`),

    // ── Flavours (baker management: the global list, overlaid with this baker's ──
    //    on/off state, per-kg rates and menu names, plus who may see the prices)
    fetchBakerFlavours: () => authGet("/api/baker/flavours"),

    // Replaces updateBakerFlavourExclusions, which is GONE rather than deprecated. That
    // one PUT a bare id list to an endpoint that replaced the whole set by deleting and
    // re-inserting — safe while a row carried nothing but its own existence, and fatal
    // once it carries a price, because a client sending only flags would wipe every rate
    // the baker had entered. Leaving it callable would have meant prices "randomly
    // failing to save" with the cause in a screen nobody was looking at.
    updateBakerFlavours: (body: {
      flavours?: {
        flavour_id: string;
        excluded?: boolean;
        // null means "not priced" — the storefront says "ask". Never 0, which would be
        // a baker advertising a free cake.
        price_per_kg?: number | null;
        display_name?: string | null;
      }[];
      visibility?: {
        // 'private' is the default and stays so until the baker says otherwise: entering
        // a rate and publishing it are separate acts.
        //
        // No `show_flavours` here. Whether a storefront DISPLAYS the flavour list is the
        // menu section's own on/off; it briefly lived on the baker and also emptied the
        // API response, which broke the order form's flavour picker.
        price_visibility?: "private" | "verified" | "public";
      };
    }) =>
      authFetch("/api/baker/flavours", {
        method: "PUT",
        body: JSON.stringify(body),
      }),

    // What this baker can't make a flavour as ("no eggless tiramisu"). Sent as the
    // EFFECTIVE set per flavour; the API stores only what differs from Spattoo's global
    // default, so the UI never has to know a baseline exists. Drives a warning on the
    // order form and a band on the X-Ray sheet — it never blocks an order.
    updateBakerFlavourDietaryConflicts: (
      conflicts: { flavourId: string; source?: string; requirementKeys: string[] }[],
    ) =>
      authFetch("/api/baker/flavours/dietary-conflicts", {
        method: "PUT",
        body: JSON.stringify({ conflicts }),
      }),

    // ── Templates (baker management: global Spattoo templates + this baker's exclusions) ──
    fetchBakerTemplates: () => authGet("/api/baker/templates"),
    updateBakerTemplateExclusions: (excludedTemplateIds: string[]) =>
      authFetch("/api/baker/templates/exclusions", {
        method: "PUT",
        body: JSON.stringify({ excluded_template_ids: excludedTemplateIds }),
      }),

    // ── Staff (owner adds a staff member) ─────────────────────────────────────
    addStaff: (payload: unknown) =>
      authFetch("/api/baker/staff", { method: "POST", body: JSON.stringify(payload) }),

    // ── Profile / Settings / Storefront publish ───────────────────────────────
    updateBakerProfile: (payload: unknown) =>
      authFetch("/api/baker/profile", { method: "PATCH", body: JSON.stringify(payload) }),
    updateBakerSettings: (settings: unknown) =>
      authFetch("/api/baker/settings", { method: "PUT", body: JSON.stringify(settings) }),
    fetchStorefrontThemes: () => authGet("/api/baker/storefront-themes"),
    // PUBLISH is the one rights gate: this is the moment the storefront becomes world-visible, so
    // it carries the baker's content-rights attestation (the API refuses it without one, and records
    // who vouched — content_attestations). `rightsAttested` MUST be the baker's real answer from the
    // publish confirmation — never default it to true.
    publishStorefront: (rightsAttested: boolean) =>
      authFetch("/api/baker/storefront/publish", {
        method: "POST",
        body: JSON.stringify({ rights_attested: rightsAttested }),
      }),
    unpublishStorefront: () => authFetch("/api/baker/storefront/unpublish", { method: "POST" }),

    // ── Storefront gallery + testimonials ─────────────────────────────────────
    // Not attested: a photo isn't public until the storefront is published, and THAT is the gate.
    addStorefrontPhoto: (key: string, caption?: string) =>
      authFetch("/api/baker/storefront-photos", {
        method: "POST",
        body: JSON.stringify({ storage_key: key, caption }),
      }),
    // Snapshot a cake design's thumbnail into the gallery as an independent photo (server copies the
    // R2 object). Presence of this method unhides the customiser's "Choose from your designs" picker.
    addStorefrontPhotoFromTemplate: (templateId: string) =>
      authFetch("/api/baker/storefront-photos/from-template", {
        method: "POST",
        body: JSON.stringify({ template_id: templateId }),
      }),
    // Snapshot a design thumbnail → { key, url } (no photo row); used to set the hero cake image.
    // Presence unhides the customiser's "Hero cake → Choose from your designs" picker.
    addStorefrontImageFromTemplate: (templateId: string) =>
      authFetch("/api/baker/storefront-image/from-template", {
        method: "POST",
        body: JSON.stringify({ template_id: templateId }),
      }),
    // Convert an uploaded storefront content image (e.g. a Highlight photo) to optimised WebP →
    // returns { key, url }. Used for section images that live in storefront_customizations jsonb.
    optimizeStorefrontImage: (key: string) =>
      authFetch("/api/baker/storefront-image", {
        method: "POST",
        body: JSON.stringify({ key }),
      }),
    updateStorefrontPhotos: (photos: unknown) =>
      authFetch("/api/baker/storefront-photos", { method: "PUT", body: JSON.stringify({ photos }) }),
    deleteStorefrontPhoto: (id: string) =>
      authFetch(`/api/baker/storefront-photos/${id}`, { method: "DELETE" }),
    updateTestimonials: (testimonials: unknown) =>
      authFetch("/api/baker/testimonials", { method: "PUT", body: JSON.stringify({ testimonials }) }),

    // ── Billing / subscription ────────────────────────────────────────────────
    fetchBillingStatus: () => authGet("/api/billing/status"),
    // Resolved entitlements + usage (e.g. orders_used vs max_orders_total) for the
    // baker — drives the "X of N orders used / upgrade" surface.
    fetchEntitlements: () => authGet("/api/baker/entitlements"),
    fetchBillingPeriods: () => authGet("/api/billing/periods"),

    // ── AI credits (the metered "smart tools" allowance) ──────────────────────
    // Returns the raw balance AND `actions` — each metered job with how many of it the baker can
    // still run. Use the COUNTS, not the credits: the prices live in the credit_costs table so they
    // can be retuned without a deploy, and a client that divides by its own copy starts lying the
    // moment they move. `usedPct` carries the 70/90/100 nudge thresholds from one place.
    // Unlimited plans report null counts, so the UI can say "included" instead of a countdown.
    fetchAiCredits: () => authGet("/api/baker/ai-credits"),
    // Top-up shelf. Each pack states what it BUYS ("20 build guides"), for the same reason.
    fetchAiCreditPacks: () => authGet("/api/baker/ai-credits/packs"),
    // Where the credits went. Each row carries the BUCKET SPLIT recorded at spend time, so a
    // baker can see the monthly-first order the terms promise rather than being asked to trust it.
    // Keyset paged — pass the `nextBefore` the server hands back, never an offset.
    fetchAiCreditHistory: (before?: string | null) =>
      authGet(`/api/baker/ai-credits/history${before ? `?before=${encodeURIComponent(before)}` : ""}`),
    // Opens a Razorpay ORDER for a pack (one-time payment, not a subscription). Returns
    // { key_id, order_id, amount } for Checkout. Credits are minted by the payment webhook, never
    // here — so a Checkout the baker abandons costs nothing and credits nothing.
    purchaseAiCredits: (packKey: string) =>
      authFetch("/api/baker/ai-credits/purchase", {
        method: "POST",
        body: JSON.stringify({ packKey }),
      }),
    // Public marketing plan catalog (one source for billing + onboarding).
    fetchPlans: () => publicGet("/api/plans"),
    fetchSubscriptionHistory: () => authGet("/api/baker/subscription/history"),
    // Payment history → { payments, total }. Fetch just the latest on first look;
    // the full (recent) list only when the baker drills in.
    fetchLatestPayment: () => authGet("/api/billing/payments?limit=1"),
    fetchPayments: () => authGet("/api/billing/payments?limit=24"),
    activateSparkPlan: () => authFetch("/api/billing/activate-spark", { method: "POST" }),
    // `intent` tags a same-tier deferred recreate for clarity/logging (the server independently confirms
    // the flow): 'change_method' re-authorizes a NEW payment method (e.g. UPI→card); 'switch_interval'
    // moves monthly↔yearly on the same tier. Both take over at the next renewal (no double charge).
    // Omitted for normal subscribe / upgrade / downgrade.
    createSubscription: (
      tier: string,
      billingPeriodId: string,
      opts?: { intent?: "change_method" | "switch_interval" },
    ) =>
      authFetch("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ tier, billing_period_id: billingPeriodId, intent: opts?.intent }),
      }),
    cancelSubscription: () => authFetch("/api/billing/cancel", { method: "POST" }),
    // Save the baker's GSTIN (captured on the checkout screen). Persisted on the profile so automatic
    // renewals reuse it. Send null/'' to clear. Server validates the 15-char GSTIN (format + checksum).
    updateTaxProfile: (gstin: string | null) =>
      authFetch("/api/billing/tax-profile", {
        method: "PATCH",
        body: JSON.stringify({ gstin }),
      }),

    // ── Self-signup (free Spark tier; no payment) ─────────────────────────────
    checkSlug: (slug: string) =>
      publicGet(`/api/bakers/slug-available?slug=${encodeURIComponent(slug)}`),
    createBakerSelf: (payload: unknown) =>
      authFetch("/api/bakers/self", { method: "POST", body: JSON.stringify(payload) }),
    // Onboarding wizard plan step — sets the plan WITHOUT charge (dev/no-payment).
    selectPlan: (plan: string) =>
      authFetch("/api/baker/plan/select", { method: "POST", body: JSON.stringify({ plan }) }),

    // ── Live co-design sessions ───────────────────────────────────────────────
    // Presence of these methods is what unhides the designer's "Design Together" entry.
    createDesignSession: (body: unknown) =>
      authFetch("/api/design-sessions", { method: "POST", body: JSON.stringify(body) }),
    getDesignSession: (id: string) => authGet(`/api/design-sessions/${id}`),
    putDesignSessionDesign: (id: string, design: unknown) =>
      authFetch(`/api/design-sessions/${id}/design`, { method: "PUT", body: JSON.stringify({ design }) }),
    penDesignSession: (id: string, body: unknown) =>
      authFetch(`/api/design-sessions/${id}/pen`, { method: "POST", body: JSON.stringify(body) }),
    endDesignSession: (id: string) =>
      authFetch(`/api/design-sessions/${id}/end`, { method: "POST" }),

    // ── Account ───────────────────────────────────────────────────────────────
    signOut: () => supabase.auth.signOut(),
    changePassword: (password: string) => supabase.auth.updateUser({ password }),
  };
}

export type BakerApiClient = ReturnType<typeof makeBakerApiClient>;
